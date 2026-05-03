# P24 — Alerting avancé : Design Document

> **Date:** 2026-04-29  
> **Approche:** Option A enrichie (réutilisation des systèmes existants)  
> **Format templates:** Markdown partout, converti en HTML côté backend pour email  
> **UI:** Onglets dans la page `/notifications` existante

---

## 1. Objectif

Permettre aux administrateurs de :

1. **Personnaliser le contenu des alertes** via des templates configurables par canal (email, Slack, Teams) au format Markdown avec variables dynamiques.
2. **Créer des webhooks déclenchés par métrique spécifique** en enrichissant le système de subscriptions webhooks existant avec un événement `metric.alert` et des filtres par métrique / sévérité.

---

## 2. Architecture

### 2.1 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND                                │
│  /notifications                                             │
│    ├─ Paramètres (actuel)                                   │
│    ├─ Templates (nouveau) ──► AlertTemplates.tsx            │
│    └─ Webhooks (nouveau) ──► WebhookSubscriptions.tsx       │
└────────────────────┬────────────────────────────────────────┘
                     │ tRPC / REST
┌────────────────────▼────────────────────────────────────────┐
│                     BACKEND                                 │
│                                                             │
│  notification.service.ts                                    │
│    ├─ dispatch()                                            │
│    │   ├─ templateService.render(channel, template, vars)   │
│    │   │   ├─ email  ──► marked(markdown) ──► HTML          │
│    │   │   ├─ slack  ──► markdown brut                      │
│    │   │   └─ teams  ──► markdown brut                      │
│    │   └─ webhooksService.emitMetricAlert(...)              │
│    │       └─ filtre subscriptions par metric + severity    │
│    │           └─ POST url + payload JSON + HMAC            │
│    └─ fallback legacy alertService                          │
│                                                             │
│  webhooks.service.ts                                        │
│    ├─ create / update / delete / list (existant)            │
│    ├─ testWebhook (existant)                                │
│    └─ emitMetricAlert(metric, severity, ...) (nouveau)      │
│                                                             │
│  template.service.ts (nouveau)                              │
│    ├─ render(channel: 'email'|'slack'|'teams', ...)         │
│    ├─ replaceVariables(template, variables)                 │
│    └─ markdownToHtml(markdown)                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Flux de données

```
Dashboard metrics fetch
  → testmo.service._checkSLA() détecte alerte
    → notificationService.dispatch(projectId, alerts)
      ├─ Charge notification_settings (global + projet)
      ├─ Pour chaque alerte :
      │   ├─ Templates :
      │   │   → templateService.render(channel, template, vars)
      │   │   → Envoi Email (HTML) / Slack (MD) / Teams (MD)
      │   └─ Webhooks :
      │       → webhooksService.emitMetricAlert(metric, severity, ...)
      │       → Filtre subscriptions actives par events + filters
      │       → POST asynchrone avec signature HMAC
      └─ Rate-limiting : max 1 alerte / projet / 15 min
```

---

## 3. Backend

### 3.1 Base de données

#### Migration `006_alert_templates.sql`

```sql
-- Templates configurables par canal
ALTER TABLE notification_settings
ADD COLUMN email_template TEXT;

ALTER TABLE notification_settings
ADD COLUMN slack_template TEXT;

ALTER TABLE notification_settings
ADD COLUMN teams_template TEXT;

-- Filtres optionnels pour les webhook subscriptions
ALTER TABLE webhook_subscriptions
ADD COLUMN filters TEXT; -- JSON optionnel, ex: {"metric":"passRate","severity":"critical"}

-- Note : SQLite ne supporte pas les index JSON natifs. L'index ci-dessus est un
-- index TEXT générique. Le filtrage par event se fait en mémoire côté
-- application (parser JSON + match) pour rester portable.
CREATE INDEX idx_webhook_subscriptions_enabled ON webhook_subscriptions(enabled);
```

#### Schéma mis à jour

**`notification_settings`**
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | INTEGER PK | |
| `project_id` | INTEGER NULL | NULL = global |
| `email` | TEXT | |
| `slack_webhook` | TEXT | |
| `teams_webhook` | TEXT | |
| `enabled_sla_email` | INTEGER | |
| `enabled_sla_slack` | INTEGER | |
| `enabled_sla_teams` | INTEGER | |
| **email_template** | TEXT NULL | Markdown template |
| **slack_template** | TEXT NULL | Markdown template |
| **teams_template** | TEXT NULL | Markdown template |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

**`webhook_subscriptions`**
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | INTEGER PK | |
| `url` | TEXT NOT NULL | |
| `events` | TEXT NOT NULL | JSON array, ex: `["metric.alert"]` |
| `secret` | TEXT NOT NULL | |
| `enabled` | INTEGER DEFAULT 1 | |
| **filters** | TEXT NULL | JSON, ex: `{"metric":"passRate","severity":"critical"}` |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

### 3.2 Services

#### `template.service.ts` (nouveau)

**Responsabilité** : Remplacer les variables dans un template Markdown et convertir selon le canal.

```typescript
interface TemplateVariables {
  metric: string;
  value: string;
  threshold: string;
  severity: 'warning' | 'critical';
  projectName: string;
  timestamp: string;
}

class TemplateService {
  render(
    channel: 'email' | 'slack' | 'teams',
    template: string | null,
    vars: TemplateVariables,
    fallback: string
  ): string;

  private replaceVariables(template: string, vars: TemplateVariables): string;
  private markdownToHtml(markdown: string): string;
}
```

**Variables supportées :**

- `{{metric}}` — nom de la métrique (ex: `passRate`)
- `{{value}}` — valeur actuelle (ex: `87.5`)
- `{{threshold}}` — seuil dépassé (ex: `90`)
- `{{severity}}` — `warning` ou `critical`
- `{{projectName}}` — nom du projet
- `{{timestamp}}` — ISO 8601

**Règles :**

- Si `template` est vide/null, utiliser `fallback` (template actuel en dur).
- Email : Markdown → HTML via `marked` (lib à installer si absente : `npm install marked` dans `backend/`).
- Slack/Teams : Markdown brut (pas de conversion).
- Variables non reconnues laissées telles quelles (pas d'erreur).

#### `webhooks.service.ts` (modifié)

**Nouvelle méthode :**

```typescript
async emitMetricAlert(
  metric: string,
  severity: 'warning' | 'critical',
  value: number,
  threshold: number,
  projectId: number,
  projectName: string
): Promise<void>
```

**Logique :**

1. Charger toutes les subscriptions actives (`enabled = 1`) dont `events` contient `"metric.alert"`.
2. Pour chaque subscription, parser `filters` (si présent).
3. Vérifier correspondance : `filters.metric === metric` (ou absent) ET `filters.severity === severity` (ou absent).
4. Construire le payload JSON :
   ```json
   {
     "event": "metric.alert",
     "timestamp": "2026-04-29T12:00:00Z",
     "data": {
       "metric": "passRate",
       "severity": "critical",
       "value": 87.5,
       "threshold": 90,
       "projectId": 42,
       "projectName": "Projet Alpha"
     }
   }
   ```
5. Signer avec HMAC-SHA256 (déjà implémenté).
6. Envoi fire-and-forget (catch et log les erreurs, ne pas bloquer).

### 3.3 API

#### tRPC — notifications router (modifié)

```typescript
// notifications.saveSettings
input: z.object({
  projectId: z.number().optional(),
  email: z.string().email().optional(),
  slackWebhook: z.string().url().optional(),
  teamsWebhook: z.string().url().optional(),
  enabledSlaEmail: z.boolean().optional(),
  enabledSlaSlack: z.boolean().optional(),
  enabledSlaTeams: z.boolean().optional(),
  // NOUVEAU
  emailTemplate: z.string().max(2000).optional(),
  slackTemplate: z.string().max(2000).optional(),
  teamsTemplate: z.string().max(2000).optional(),
});

// notifications.testWebhook (existant) — étendu pour supporter test de template
input: z.object({
  channel: z.enum(['email', 'slack', 'teams']),
  template: z.string().optional(), // NOUVEAU
});
```

#### tRPC — webhooks router (existant, inchangé)

Le CRUD REST/tRPC existe déjà. Le champ `filters` est passé comme string JSON via le `z.object()` existant. Pas de changement de signature nécessaire.

---

## 4. Frontend

### 4.1 Page `/notifications` — Onglets

La page existante `NotificationSettings.tsx` est refactorée en composant à onglets.

```
/NotificationsPage.tsx (refactor de NotificationSettings.tsx)
├── Tabs
│   ├── Paramètres ──► NotificationChannels.tsx (extraction du code actuel)
│   ├── Templates  ──► AlertTemplates.tsx (nouveau)
│   └── Webhooks   ──► WebhookSubscriptions.tsx (nouveau)
```

### 4.2 Composants

#### `AlertTemplates.tsx` (nouveau)

**Responsabilité** : Éditer et prévisualiser les 3 templates d'alerte.

**UI :**

- 3 sections empilées (Email, Slack, Teams).
- Chaque section : textarea pour le template + zone de preview en temps réel.
- Liste des variables disponibles en chip cliquable (insère `{{variable}}` au curseur).
- Bouton "Sauvegarder" global (sauvegarde les 3 templates en une seule mutation).
- Bouton "Réinitialiser" (supprime les templates personnalisés, retour au fallback).

**Preview :**

- Email : rendu HTML (via `marked` côté frontend ou simple preview MD).
- Slack/Teams : rendu Markdown brut avec styles basiques.

#### `WebhookSubscriptions.tsx` (nouveau)

**Responsabilité** : CRUD des subscriptions webhooks avec filtres conditionnels.

**UI :**

- Table listant les subscriptions (URL, events, enabled, filtres).
- Bouton "Ajouter" → Drawer/Modal d'édition.
- Form d'édition :
  - URL (input)
  - Events (multi-select) : liste des events applicatifs + `metric.alert`
  - **Conditionnel** : si `metric.alert` est sélectionné, afficher :
    - Métrique (select) : `completionRate`, `passRate`, `failureRate`, `blockedRate`, `escapeRate`, `detectionRate`, `testEfficiency`
    - Sévérité (select) : `warning`, `critical`, `both`
  - Secret (input password)
  - Toggle enabled
- Bouton "Tester" sur chaque ligne (envoie un payload de test `metric.alert`).

#### `NotificationChannels.tsx` (extraction)

Code actuel de `NotificationSettings.tsx` extrait dans un sous-composant pour l'onglet "Paramètres".

### 4.3 Hooks

#### `useWebhooks.ts` (nouveau)

```typescript
export function useWebhooks() {
  return trpc.webhooks.list.useQuery();
}
```

#### `useSaveWebhooks.ts` (nouveau)

```typescript
export function useCreateWebhook() {
  return trpc.webhooks.create.useMutation();
}
export function useUpdateWebhook() {
  return trpc.webhooks.update.useMutation();
}
export function useDeleteWebhook() {
  return trpc.webhooks.delete.useMutation();
}
```

#### `useAlertTemplates.ts` (nouveau)

```typescript
export function useAlertTemplates() {
  return trpc.notifications.settings.useQuery();
}
export function useSaveAlertTemplates() {
  return trpc.notifications.saveSettings.useMutation();
}
```

---

## 5. Intégration avec le système existant

### 5.1 `notification.service.ts`

Modifier `dispatch()` pour :

1. Récupérer les templates depuis `notification_settings`.
2. Pour chaque canal activé, appeler `templateService.render()` au lieu du formatage en dur.
3. Après le dispatch classique, appeler `webhooksService.emitMetricAlert()` pour chaque alerte.

### 5.2 `testmo.service.ts`

Pas de modification nécessaire. `_checkSLA()` continue de produire le même shape d'alerte.

### 5.3 Fallback

- Pas de templates personnalisés → template par défaut actuel.
- Pas de webhook `metric.alert` configuré → aucun impact (émission vide, pas d'erreur).
- Pas de `filters` sur une subscription → la subscription reçoit TOUTES les alertes `metric.alert`.

### 5.4 Migration

La migration `006_alert_templates.sql` doit être placée dans `backend/db/migrations/sync-history/` et exécutée manuellement ou via le mécanisme de migration existant du projet (à vérifier au moment de l'implémentation).

---

## 6. Tests

### 6.1 Backend

| Fichier                        | Type        | Ce qu'on teste                                            |
| ------------------------------ | ----------- | --------------------------------------------------------- |
| `template.service.test.ts`     | Unit        | Remplacement des variables, fallback, conversion MD→HTML  |
| `notification.service.test.ts` | Intégration | Les templates personnalisés sont utilisés si présents     |
| `webhooks.service.test.ts`     | Intégration | `emitMetricAlert` filtre correctement par metric/severity |

### 6.2 Frontend

| Fichier                         | Type      | Ce qu'on teste                                          |
| ------------------------------- | --------- | ------------------------------------------------------- |
| `AlertTemplates.test.tsx`       | Composant | Render, saisie textarea, preview, sauvegarde            |
| `WebhookSubscriptions.test.tsx` | Composant | Render table, ajout, filtres conditionnels, suppression |
| `NotificationSettings.test.tsx` | Composant | Navigation entre onglets                                |

---

## 7. Définition de Done

- [ ] Les templates d'alerte configurables fonctionnent pour les 3 canaux (email, Slack, Teams).
- [ ] La prévisualisation en temps réel fonctionne dans l'UI.
- [ ] Les webhooks `metric.alert` se déclenchent uniquement pour les métriques/sévérités filtrées.
- [ ] Le payload webhook contient toutes les informations de l'alerte.
- [ ] Les tests backend passent (100% des nouveaux services).
- [ ] Les tests frontend passent (100% des nouveaux composants).
- [ ] Le build frontend réussit.
- [ ] Le typecheck backend passe sans erreur.
- [ ] La migration DB s'applique correctement.
- [ ] ROADMAP.md mis à jour (P24 coché).

---

## 8. Livrables

| Feature               | Fichiers créés                                                      | Fichiers modifiés                                             |
| --------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------- |
| Templates d'alerte    | `template.service.ts`, `AlertTemplates.tsx`, `useAlertTemplates.ts` | `notification.service.ts`, `notification_settings` migration  |
| Webhooks par métrique | `WebhookSubscriptions.tsx`, `useWebhooks.ts`, `useSaveWebhooks.ts`  | `webhooks.service.ts`, `webhook_subscriptions` migration      |
| UI onglets            | `NotificationChannels.tsx`                                          | `NotificationSettings.tsx`, `AppLayout.tsx` (si nav modifiée) |
| Tests                 | `*.test.ts`, `*.test.tsx`                                           | —                                                             |
