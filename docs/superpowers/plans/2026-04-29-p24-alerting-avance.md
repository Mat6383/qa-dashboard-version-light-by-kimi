# P24 — Alerting avancé Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use inline execution with executing-plans or subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter des templates d'alerte configurables (Markdown, par canal) et des webhooks personnalisés par métrique avec filtres severity/métrique.

**Architecture:** Réutiliser les systèmes existants (`notification_settings`, `webhook_subscriptions`) en les enrichissant. Backend: `template.service.ts` pour le rendu Markdown→HTML, `webhooks.service.ts` avec `emitMetricAlert()`. Frontend: page `/notifications` refactorée en onglets avec `AlertTemplates.tsx` et `WebhookSubscriptions.tsx`.

**Tech Stack:** TypeScript, React, tRPC, SQLite (better-sqlite3), Jest (backend), Vitest + Testing Library (frontend), marked (déjà présent backend).

---

## File Structure

### Backend — Created

- `backend/services/template.service.ts`
- `backend/services/template.service.test.ts`
- `backend/db/migrations/sync-history/006_alert_templates.sql`

### Backend — Modified

- `backend/services/notification.service.ts`
- `backend/services/notification.service.test.ts`
- `backend/services/webhooks.service.ts`
- `backend/services/webhooks.service.test.ts`
- `backend/trpc/routers/notifications.ts`
- `backend/trpc/routers/webhooks.ts`

### Frontend — Created

- `frontend/src/components/NotificationChannels.tsx`
- `frontend/src/components/AlertTemplates.tsx`
- `frontend/src/components/AlertTemplates.test.tsx`
- `frontend/src/components/WebhookSubscriptions.tsx`
- `frontend/src/components/WebhookSubscriptions.test.tsx`
- `frontend/src/hooks/mutations/useWebhooks.ts`
- `frontend/src/hooks/mutations/useAlertTemplates.ts`

### Frontend — Modified

- `frontend/src/components/NotificationSettings.tsx`
- `frontend/src/components/NotificationSettings.test.tsx`
- `frontend/src/hooks/mutations/useNotifications.ts`

### Other

- `e2e/alerting-advanced.spec.js`
- `ROADMAP.md`

---

## Task 1: Migration base de données

**Files:**

- Create: `backend/db/migrations/sync-history/006_alert_templates.sql`

- [ ] **Step 1: Écrire la migration**

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
ADD COLUMN filters TEXT;

-- Index pour filtrer les subscriptions actives
CREATE INDEX idx_webhook_subscriptions_enabled ON webhook_subscriptions(enabled);
```

- [ ] **Step 2: Appliquer la migration manuellement**

Run:

```bash
cd backend && npx ts-node -e "
const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'db/sync-history.db'));
const sql = require('fs').readFileSync(path.join(__dirname, 'db/migrations/sync-history/006_alert_templates.sql'), 'utf8');
db.exec(sql);
console.log('Migration 006 appliquée');
"
```

Expected: `Migration 006 appliquée`

- [ ] **Step 3: Commit**

```bash
git add backend/db/migrations/sync-history/006_alert_templates.sql
git commit -m "db(P24): add alert templates and webhook filters migration"
```

---

## Task 2: Template Service + Tests

**Files:**

- Create: `backend/services/template.service.ts`
- Create: `backend/services/template.service.test.ts`

- [ ] **Step 1: Écrire le test failing**

```typescript
import templateService from './template.service';

describe('TemplateService', () => {
  test('replaceVariables remplace toutes les variables', () => {
    const result = (templateService as any).replaceVariables(
      'Alerte {{severity}}: {{metric}} = {{value}}% (seuil {{threshold}})',
      {
        metric: 'passRate',
        value: '87.5',
        threshold: '90',
        severity: 'critical',
        projectName: 'Alpha',
        timestamp: '2026-04-29T12:00:00Z',
      }
    );
    expect(result).toBe('Alerte critical: passRate = 87.5% (seuil 90)');
  });

  test('render utilise le template personnalisé si fourni', () => {
    const result = templateService.render(
      'email',
      'Custom {{metric}}',
      {
        metric: 'passRate',
        value: '87.5',
        threshold: '90',
        severity: 'critical',
        projectName: 'Alpha',
        timestamp: '2026-04-29T12:00:00Z',
      },
      'Fallback'
    );
    expect(result).toBe('Custom passRate');
  });

  test('render utilise le fallback si template null', () => {
    const result = templateService.render(
      'email',
      null,
      {
        metric: 'passRate',
        value: '87.5',
        threshold: '90',
        severity: 'critical',
        projectName: 'Alpha',
        timestamp: '2026-04-29T12:00:00Z',
      },
      'Fallback {{metric}}'
    );
    expect(result).toBe('Fallback passRate');
  });

  test('markdownToHtml convertit le markdown en HTML', () => {
    const result = (templateService as any).markdownToHtml('# Hello\n\n**bold**');
    expect(result).toContain('<h1>');
    expect(result).toContain('<strong>bold</strong>');
  });

  test('render email convertit en HTML', () => {
    const result = templateService.render(
      'email',
      '# {{metric}}\n\nValue: {{value}}',
      {
        metric: 'passRate',
        value: '87.5',
        threshold: '90',
        severity: 'critical',
        projectName: 'Alpha',
        timestamp: '2026-04-29T12:00:00Z',
      },
      'Fallback'
    );
    expect(result).toContain('<h1>passRate</h1>');
    expect(result).toContain('<p>Value: 87.5</p>');
  });

  test('render slack laisse le markdown brut', () => {
    const result = templateService.render(
      'slack',
      '# {{metric}}',
      {
        metric: 'passRate',
        value: '87.5',
        threshold: '90',
        severity: 'critical',
        projectName: 'Alpha',
        timestamp: '2026-04-29T12:00:00Z',
      },
      'Fallback'
    );
    expect(result).toBe('# passRate');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest services/template.service.test.ts --no-coverage`
Expected: FAIL — `Cannot find module './template.service'`

- [ ] **Step 3: Implémenter template.service.ts**

```typescript
import { marked } from 'marked';

export interface TemplateVariables {
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
    template: string | null | undefined,
    vars: TemplateVariables,
    fallback: string
  ): string {
    const source = template || fallback;
    const replaced = this.replaceVariables(source, vars);
    if (channel === 'email') {
      return this.markdownToHtml(replaced);
    }
    return replaced;
  }

  replaceVariables(template: string, vars: TemplateVariables): string {
    return template
      .replace(/\{\{metric\}\}/g, vars.metric)
      .replace(/\{\{value\}\}/g, vars.value)
      .replace(/\{\{threshold\}\}/g, vars.threshold)
      .replace(/\{\{severity\}\}/g, vars.severity)
      .replace(/\{\{projectName\}\}/g, vars.projectName)
      .replace(/\{\{timestamp\}\}/g, vars.timestamp);
  }

  markdownToHtml(markdown: string): string {
    return marked.parse(markdown, { async: false }) as string;
  }
}

export default new TemplateService();
```

- [ ] **Step 4: Run tests**

Run: `cd backend && npx jest services/template.service.test.ts --no-coverage`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/services/template.service.ts backend/services/template.service.test.ts
git commit -m "feat(P24): add template service with Markdown rendering and variable replacement"
```

---

## Task 3: Modifier Notification Service (templates + webhooks emit)

**Files:**

- Modify: `backend/services/notification.service.ts`
- Modify: `backend/services/notification.service.test.ts`

- [ ] **Step 1: Lire le fichier actuel et identifier les lignes à modifier**

Fichier: `backend/services/notification.service.ts`
Lignes à modifier:

- Lignes 1-6: ajouter l'import de templateService et webhooksService
- Lignes 29-87: modifier `dispatch()` pour utiliser les templates et émettre les webhooks
- Lignes 98-142: modifier `upsertSettings()` pour inclure les templates

- [ ] **Step 2: Modifier les imports et le dispatch**

Remplacer les lignes 1-6 par:

```typescript
import emailService from './email.service';
import alertService from './alert.service';
import logger from './logger.service';
import Database from 'better-sqlite3';
import path from 'path';
import { run as runMigrations } from '../db/migrate';
import templateService from './template.service';
import webhooksService from './webhooks.service';
```

Modifier la méthode `dispatch` (lignes 29-87) pour:

1. Utiliser les templates personnalisés
2. Appeler `webhooksService.emitMetricAlert` pour chaque alerte

Le code complet de `dispatch` devient:

```typescript
  async dispatch(projectId: any, alerts: any, projectName: string | null = null) {
    if (!alerts || alerts.length === 0) return;

    const settings = this.getSettings(projectId);
    const defaultSettings = this.getSettings(null);
    const merged = this._mergeSettings(settings, defaultSettings);

    if (!merged) {
      return alertService.sendSLAAlert(projectId, alerts);
    }

    if (this._isRateLimited(projectId)) {
      logger.info(`[NotificationService] Rate-limit actif pour projet ${projectId} — alerte ignorée`);
      return;
    }

    const promises = [];

    for (const alert of alerts) {
      const vars = {
        metric: alert.metric,
        value: String(alert.value),
        threshold: String(alert.threshold),
        severity: alert.severity,
        projectName: projectName || `Projet ${projectId}`,
        timestamp: new Date().toISOString(),
      };

      if (merged.enabled_sla_email && merged.email) {
        const subject = templateService.render('email', merged.email_template, vars, `🚨 Alerte SLA — ${alert.metric}`);
        const body = templateService.render('email', merged.email_template, vars, `**${alert.severity.toUpperCase()}** — ${alert.metric}: ${alert.value}% (seuil: ${alert.threshold}%)`);
        promises.push(
          emailService
            .sendSLAAlert({
              to: merged.email,
              projectId,
              projectName: projectName || null,
              alerts: [{ ...alert, renderedSubject: subject, renderedBody: body }],
              dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/?project=${projectId}`,
            })
            .then((r: any) => {
              if (r.sent) this._logAlert(projectId, 'email');
            })
        );
      }

      if (merged.enabled_sla_slack && merged.slack_webhook) {
        const text = templateService.render('slack', merged.slack_template, vars, alertService._formatSlackMessage(projectId, [alert]));
        promises.push(
          alertService
            ._sendSlack(text, merged.slack_webhook)
            .then(() => this._logAlert(projectId, 'slack'))
        );
      }

      if (merged.enabled_sla_teams && merged.teams_webhook) {
        // Teams: on garde la structure MessageCard mais on utilise le template pour le summary/activityTitle si fourni
        const customText = templateService.render('teams', merged.teams_template, vars, '');
        const teamsCard = alertService._formatTeamsCard(projectId, [alert]);
        if (customText) {
          teamsCard.summary = customText;
          teamsCard.sections[0].activityTitle = customText;
        }
        promises.push(
          alertService
            ._sendTeams(teamsCard, merged.teams_webhook)
            .then(() => this._logAlert(projectId, 'teams'))
        );
      }

      // Émettre les webhooks métriques
      promises.push(
        webhooksService.emitMetricAlert(
          alert.metric,
          alert.severity,
          alert.value,
          alert.threshold,
          projectId,
          projectName || `Projet ${projectId}`
        )
      );
    }

    if (promises.length === 0) {
      return alertService.sendSLAAlert(projectId, alerts);
    }

    await Promise.all(promises);
  }
```

- [ ] **Step 3: Modifier upsertSettings pour les templates**

Remplacer la méthode `upsertSettings` (lignes 98-142) par:

```typescript
  upsertSettings({ projectId, email, slackWebhook, teamsWebhook, enabledSlaEmail, enabledSlaSlack, enabledSlaTeams, emailTemplate, slackTemplate, teamsTemplate }: any) {
    const existing = this.getSettings(projectId || null);
    if (existing) {
      this.db
        .prepare(
          `
        UPDATE notification_settings SET
          email = ?,
          slack_webhook = ?,
          teams_webhook = ?,
          enabled_sla_email = ?,
          enabled_sla_slack = ?,
          enabled_sla_teams = ?,
          email_template = ?,
          slack_template = ?,
          teams_template = ?,
          updated_at = datetime('now')
        WHERE project_id = ?
      `
        )
        .run(
          email || null,
          slackWebhook || null,
          teamsWebhook || null,
          enabledSlaEmail ? 1 : 0,
          enabledSlaSlack ? 1 : 0,
          enabledSlaTeams ? 1 : 0,
          emailTemplate || null,
          slackTemplate || null,
          teamsTemplate || null,
          projectId || null
        );
    } else {
      this.db
        .prepare(
          `
        INSERT INTO notification_settings (project_id, email, slack_webhook, teams_webhook, enabled_sla_email, enabled_sla_slack, enabled_sla_teams, email_template, slack_template, teams_template, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `
        )
        .run(
          projectId || null,
          email || null,
          slackWebhook || null,
          teamsWebhook || null,
          enabledSlaEmail ? 1 : 0,
          enabledSlaSlack ? 1 : 0,
          enabledSlaTeams ? 1 : 0,
          emailTemplate || null,
          slackTemplate || null,
          teamsTemplate || null
        );
    }
    return this.getSettings(projectId || null);
  }
```

- [ ] **Step 4: Modifier getSettings pour retourner les templates**

La méthode `getSettings` retourne déjà `SELECT *` donc les nouvelles colonnes sont automatiquement incluses. Pas de modification nécessaire.

- [ ] **Step 5: Ajouter/adapter les tests backend**

Ajouter dans `backend/services/notification.service.test.ts` (ou créer s'il n'existe pas):

```typescript
import notificationService from './notification.service';
import templateService from './template.service';
import webhooksService from './webhooks.service';

jest.mock('./template.service', () => ({
  render: jest.fn((channel, template, vars, fallback) => template || fallback),
}));

jest.mock('./webhooks.service', () => ({
  emitMetricAlert: jest.fn().mockResolvedValue(undefined),
}));

describe('NotificationService.dispatch with templates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('utilise le template personnalisé email si présent', async () => {
    // Mock DB avec template personnalisé
    const originalGetSettings = notificationService.getSettings.bind(notificationService);
    notificationService.getSettings = jest
      .fn()
      .mockReturnValueOnce({
        email: 'test@test.com',
        enabled_sla_email: 1,
        email_template: 'Custom {{metric}}: {{value}}',
      })
      .mockReturnValueOnce(null);

    await notificationService.dispatch(1, [{ metric: 'passRate', value: 85, threshold: 90, severity: 'warning' }]);

    expect(templateService.render).toHaveBeenCalledWith(
      'email',
      'Custom {{metric}}: {{value}}',
      expect.objectContaining({ metric: 'passRate', value: '85' }),
      expect.any(String)
    );

    notificationService.getSettings = originalGetSettings;
  });

  test('émet les webhooks métriques pour chaque alerte', async () => {
    const originalGetSettings = notificationService.getSettings.bind(notificationService);
    notificationService.getSettings = jest
      .fn()
      .mockReturnValueOnce({
        email: 'test@test.com',
        enabled_sla_email: 1,
      })
      .mockReturnValueOnce(null);

    await notificationService.dispatch(1, [
      { metric: 'passRate', value: 85, threshold: 90, severity: 'warning' },
      { metric: 'blockedRate', value: 10, threshold: 5, severity: 'critical' },
    ]);

    expect(webhooksService.emitMetricAlert).toHaveBeenCalledTimes(2);
    expect(webhooksService.emitMetricAlert).toHaveBeenCalledWith('passRate', 'warning', 85, 90, 1, expect.any(String));
    expect(webhooksService.emitMetricAlert).toHaveBeenCalledWith(
      'blockedRate',
      'critical',
      10,
      5,
      1,
      expect.any(String)
    );

    notificationService.getSettings = originalGetSettings;
  });
});
```

- [ ] **Step 6: Run backend tests**

Run: `cd backend && npx jest services/notification.service.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/services/notification.service.ts backend/services/notification.service.test.ts
git commit -m "feat(P24): integrate templates and metric webhooks into notification service"
```

---

## Task 4: Modifier Webhooks Service (emitMetricAlert + filters)

**Files:**

- Modify: `backend/services/webhooks.service.ts`
- Modify: `backend/services/webhooks.service.test.ts`

- [ ] **Step 1: Modifier create et getAll pour inclure filters**

Dans `create()` (ligne ~18), ajouter `filters` au paramètre et à l'INSERT:

```typescript
  create(url: any, events: any, secret: any, filters: any = null) {
    const db = this._db();
    if (!db) return null;
    try {
      const now = new Date().toISOString();
      const result = db
        .prepare(
          `INSERT INTO webhook_subscriptions (url, events, secret, enabled, filters, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(url, JSON.stringify(events), secret, 1, filters ? JSON.stringify(filters) : null, now, now);
      logger.info(`Webhooks: subscription créée #${result.lastInsertRowid} → ${url}`);
      return this.getById(result.lastInsertRowid);
    } catch (err: any) {
      logger.error('Webhooks: create error', err.message);
      return null;
    }
  }
```

Dans `getAll()` (ligne ~40), ajouter `filters`:

```typescript
  getAll() {
    const db = this._db();
    if (!db) return [];
    try {
      const rows = db
        .prepare('SELECT id, url, events, enabled, filters, created_at, updated_at FROM webhook_subscriptions ORDER BY id DESC')
        .all();
      return rows.map((r: any) => ({
        id: r.id,
        url: r.url,
        events: JSON.parse(r.events),
        enabled: Boolean(r.enabled),
        filters: r.filters ? JSON.parse(r.filters) : null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    } catch (err: any) {
      logger.error('Webhooks: getAll error', err.message);
      return [];
    }
  }
```

Dans `getById()` (ligne ~65), ajouter `filters`:

```typescript
  getById(id: any) {
    const db = this._db();
    if (!db) return null;
    try {
      const row = db
        .prepare('SELECT id, url, events, enabled, filters, created_at, updated_at FROM webhook_subscriptions WHERE id = ?')
        .get(id);
      if (!row) return null;
      return {
        id: row.id,
        url: row.url,
        events: JSON.parse(row.events),
        enabled: Boolean(row.enabled),
        filters: row.filters ? JSON.parse(row.filters) : null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (err: any) {
      logger.error(`Webhooks: getById(${id}) error`, err.message);
      return null;
    }
  }
```

Dans `update()` (ligne ~92), ajouter `filters`:

```typescript
  update(id: any, { url, events, secret, enabled, filters }: any) {
    const db = this._db();
    if (!db) return false;
    try {
      const sets = ['updated_at = ?'];
      const values: any[] = [new Date().toISOString()];

      if (typeof url === 'string') {
        sets.push('url = ?');
        values.push(url);
      }
      if (Array.isArray(events)) {
        sets.push('events = ?');
        values.push(JSON.stringify(events));
      }
      if (typeof secret === 'string') {
        sets.push('secret = ?');
        values.push(secret);
      }
      if (typeof enabled === 'boolean') {
        sets.push('enabled = ?');
        values.push(enabled ? 1 : 0);
      }
      if (filters !== undefined) {
        sets.push('filters = ?');
        values.push(filters ? JSON.stringify(filters) : null);
      }

      values.push(id);
      const result = db.prepare(`UPDATE webhook_subscriptions SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      return result.changes > 0;
    } catch (err: any) {
      logger.error(`Webhooks: update(${id}) error`, err.message);
      return false;
    }
  }
```

- [ ] **Step 2: Ajouter emitMetricAlert**

Ajouter après la méthode `trigger()` (après ligne 156):

```typescript
  /**
   * Émet un event metric.alert vers les subscriptions qui écoutent cet event
   * et dont les filtres correspondent.
   */
  async emitMetricAlert(
    metric: string,
    severity: 'warning' | 'critical',
    value: number,
    threshold: number,
    projectId: number,
    projectName: string
  ): Promise<void> {
    const subs = this.getAll().filter((s: any) => {
      if (!s.enabled) return false;
      if (!s.events.includes('metric.alert')) return false;
      if (!s.filters) return true;
      if (s.filters.metric && s.filters.metric !== metric) return false;
      if (s.filters.severity && s.filters.severity !== severity) return false;
      return true;
    });

    if (subs.length === 0) return;

    const payload = {
      metric,
      severity,
      value,
      threshold,
      projectId,
      projectName,
    };

    for (const sub of subs) {
      this._send(sub, 'metric.alert', payload).catch(() => {});
    }
  }
```

- [ ] **Step 3: Ajouter les tests**

Ajouter dans `backend/services/webhooks.service.test.ts` (ou créer):

```typescript
import webhooksService from './webhooks.service';

jest.mock('./syncHistory.service', () => ({
  _initialized: true,
  initDb: jest.fn(),
  db: {
    prepare: jest.fn().mockReturnThis(),
    run: jest.fn().mockReturnValue({ lastInsertRowid: 1, changes: 1 }),
    get: jest.fn(),
    all: jest.fn().mockReturnValue([]),
  },
}));

describe('WebhooksService.emitMetricAlert', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('envoie aux subscriptions metric.alert sans filtres', async () => {
    const mockSend = jest.spyOn(webhooksService as any, '_send').mockResolvedValue(undefined);
    jest
      .spyOn(webhooksService, 'getAll')
      .mockReturnValue([
        { id: 1, url: 'http://hook1', events: ['metric.alert'], enabled: true, filters: null, secret: 'secret1' },
      ]);

    await webhooksService.emitMetricAlert('passRate', 'critical', 85, 90, 1, 'Alpha');

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'http://hook1' }),
      'metric.alert',
      expect.objectContaining({ metric: 'passRate', severity: 'critical' })
    );
    mockSend.mockRestore();
  });

  test('filtre par métrique', async () => {
    const mockSend = jest.spyOn(webhooksService as any, '_send').mockResolvedValue(undefined);
    jest.spyOn(webhooksService, 'getAll').mockReturnValue([
      {
        id: 1,
        url: 'http://hook1',
        events: ['metric.alert'],
        enabled: true,
        filters: { metric: 'passRate' },
        secret: 's1',
      },
      {
        id: 2,
        url: 'http://hook2',
        events: ['metric.alert'],
        enabled: true,
        filters: { metric: 'blockedRate' },
        secret: 's2',
      },
    ]);

    await webhooksService.emitMetricAlert('passRate', 'critical', 85, 90, 1, 'Alpha');

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'http://hook1' }),
      'metric.alert',
      expect.anything()
    );
    mockSend.mockRestore();
  });

  test('filtre par sévérité', async () => {
    const mockSend = jest.spyOn(webhooksService as any, '_send').mockResolvedValue(undefined);
    jest.spyOn(webhooksService, 'getAll').mockReturnValue([
      {
        id: 1,
        url: 'http://hook1',
        events: ['metric.alert'],
        enabled: true,
        filters: { severity: 'warning' },
        secret: 's1',
      },
      {
        id: 2,
        url: 'http://hook2',
        events: ['metric.alert'],
        enabled: true,
        filters: { severity: 'critical' },
        secret: 's2',
      },
    ]);

    await webhooksService.emitMetricAlert('passRate', 'critical', 85, 90, 1, 'Alpha');

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'http://hook2' }),
      'metric.alert',
      expect.anything()
    );
    mockSend.mockRestore();
  });

  test('ignore les subscriptions non actives', async () => {
    const mockSend = jest.spyOn(webhooksService as any, '_send').mockResolvedValue(undefined);
    jest
      .spyOn(webhooksService, 'getAll')
      .mockReturnValue([
        { id: 1, url: 'http://hook1', events: ['metric.alert'], enabled: false, filters: null, secret: 's1' },
      ]);

    await webhooksService.emitMetricAlert('passRate', 'critical', 85, 90, 1, 'Alpha');

    expect(mockSend).not.toHaveBeenCalled();
    mockSend.mockRestore();
  });
});
```

- [ ] **Step 4: Run tests**

Run: `cd backend && npx jest services/webhooks.service.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/services/webhooks.service.ts backend/services/webhooks.service.test.ts
git commit -m "feat(P24): add emitMetricAlert with metric/severity filters to webhooks service"
```

---

## Task 5: Modifier tRPC Routers

**Files:**

- Modify: `backend/trpc/routers/notifications.ts`
- Modify: `backend/trpc/routers/webhooks.ts`

- [ ] **Step 1: Modifier notifications router**

Dans `backend/trpc/routers/notifications.ts`, modifier le `saveSettingsInput`:

```typescript
const saveSettingsInput = z.object({
  projectId: z.number().int().positive().nullable().optional(),
  email: z.string().email().nullable().optional(),
  slackWebhook: z.string().url().nullable().optional(),
  teamsWebhook: z.string().url().nullable().optional(),
  enabledSlaEmail: z.boolean().optional(),
  enabledSlaSlack: z.boolean().optional(),
  enabledSlaTeams: z.boolean().optional(),
  emailTemplate: z.string().max(2000).nullable().optional(),
  slackTemplate: z.string().max(2000).nullable().optional(),
  teamsTemplate: z.string().max(2000).nullable().optional(),
});
```

La mutation `saveSettings` passe déjà l'input brut à `notificationService.upsertSettings`, donc les nouveaux champs sont automatiquement transmis. Pas d'autre modification nécessaire.

Modifier le `testInput` pour supporter le test de template:

```typescript
const testInput = z.object({
  channel: z.string().min(1),
  url: z.string().url(),
  template: z.string().optional(),
});
```

La mutation `testWebhook` passe déjà `{ channel, url }` à `notificationService.testWebhook()`. Modifier `notificationService.testWebhook()` pour supporter le template:

```typescript
  async testWebhook(channel: any, url: any, template?: string) {
    if (channel === 'slack') {
      const text = template || '✅ Test de connexion — QA Dashboard Slack';
      await alertService._sendSlack(text, url);
      return { ok: true };
    }
    if (channel === 'teams') {
      const card = {
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        themeColor: '10B981',
        summary: template || 'Test QA Dashboard',
        sections: [{ activityTitle: template || '✅ Test de connexion — QA Dashboard Teams' }],
      };
      await alertService._sendTeams(card, url);
      return { ok: true };
    }
    return { ok: false, error: 'Canal inconnu' };
  }
```

- [ ] **Step 2: Modifier webhooks router**

Dans `backend/trpc/routers/webhooks.ts`, ajouter `filters` aux inputs:

```typescript
const createInput = z.object({
  url: z.string().url('URL invalide'),
  events: z.array(z.string().min(1)).min(1, 'Au moins un event requis'),
  secret: z.string().min(1, 'Secret requis'),
  filters: z.record(z.any()).nullable().optional(),
});

const updateInput = z.object({
  url: z.string().url('URL invalide').optional(),
  events: z.array(z.string().min(1)).min(1, 'Au moins un event requis').optional(),
  secret: z.string().min(1, 'Secret requis').optional(),
  enabled: z.boolean().optional(),
  filters: z.record(z.any()).nullable().optional(),
});
```

Modifier les mutations pour passer `filters`:

```typescript
  create: adminProcedure
    .input(createInput)
    .mutation(({ input }) => {
      const sub = webhooksService.create(input.url, input.events, input.secret, input.filters);
      ...
    }),

  update: adminProcedure
    .input(idInput.merge(updateInput))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      ...
      const ok = webhooksService.update(id, data);
      ...
    }),
```

- [ ] **Step 3: Run typecheck backend**

Run: `cd backend && npx tsc --noEmit`
Expected: 0 erreur

- [ ] **Step 4: Commit**

```bash
git add backend/trpc/routers/notifications.ts backend/trpc/routers/webhooks.ts backend/services/notification.service.ts
git commit -m "feat(P24): update tRPC routers with templates and webhook filters"
```

---

## Task 6: Frontend Hooks

**Files:**

- Create: `frontend/src/hooks/mutations/useWebhooks.ts`
- Create: `frontend/src/hooks/mutations/useAlertTemplates.ts`

- [ ] **Step 1: Créer useWebhooks.ts**

```typescript
import { trpc } from '../../trpc/client';

export function useWebhooks() {
  return trpc.webhooks.list.useQuery();
}

export function useCreateWebhook() {
  const utils = trpc.useUtils();
  return trpc.webhooks.create.useMutation({
    onSuccess: () => utils.webhooks.list.invalidate(),
  });
}

export function useUpdateWebhook() {
  const utils = trpc.useUtils();
  return trpc.webhooks.update.useMutation({
    onSuccess: () => utils.webhooks.list.invalidate(),
  });
}

export function useDeleteWebhook() {
  const utils = trpc.useUtils();
  return trpc.webhooks.delete.useMutation({
    onSuccess: () => utils.webhooks.list.invalidate(),
  });
}
```

- [ ] **Step 2: Créer useAlertTemplates.ts**

```typescript
import { trpc } from '../../trpc/client';

export function useAlertTemplatesSettings() {
  return trpc.notifications.settings.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
}

export function useSaveAlertTemplates() {
  return trpc.notifications.saveSettings.useMutation();
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/mutations/useWebhooks.ts frontend/src/hooks/mutations/useAlertTemplates.ts
git commit -m "feat(P24): add webhooks and alert templates frontend hooks"
```

---

## Task 7: Refactor NotificationSettings en onglets + extraction NotificationChannels

**Files:**

- Create: `frontend/src/components/NotificationChannels.tsx`
- Modify: `frontend/src/components/NotificationSettings.tsx`

- [ ] **Step 1: Extraire NotificationChannels**

Le code actuel de `NotificationSettings.tsx` (lignes 1-209) devient `NotificationChannels.tsx`.
Créer `frontend/src/components/NotificationChannels.tsx` avec le contenu exact de `NotificationSettings.tsx` actuel, mais exporté comme `export default function NotificationChannels({ isDark, settings, setSettings, onSave, savePending, onTest })`.

En pratique, copier le contenu actuel de `NotificationSettings.tsx` dans `NotificationChannels.tsx` et adapter:

```typescript
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Mail, MessageSquare, Send, Save, TestTube } from 'lucide-react';

export default function NotificationChannels({ isDark, settings, setSettings, onSave, savePending, onTest }) {
  const { t } = useTranslation();

  const cardStyle = { ... };
  const labelStyle = { ... };
  const inputStyle = { ... };

  return (
    <div>
      <div style={cardStyle}> ...email... </div>
      <div style={cardStyle}> ...slack... </div>
      <div style={cardStyle}> ...teams... </div>
      <button onClick={onSave} disabled={savePending}> ... </button>
    </div>
  );
}
```

- [ ] **Step 2: Réécrire NotificationSettings avec onglets**

```typescript
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../hooks/useToast';
import { trpc } from '../trpc/client';
import { useSaveNotificationSettings, useTestNotificationWebhook } from '../hooks/mutations/useNotifications';
import { useSaveAlertTemplates, useAlertTemplatesSettings } from '../hooks/mutations/useAlertTemplates';
import { useWebhooks, useCreateWebhook, useUpdateWebhook, useDeleteWebhook } from '../hooks/mutations/useWebhooks';
import { Bell, Settings, FileText, Webhook } from 'lucide-react';
import NotificationChannels from './NotificationChannels';
import AlertTemplates from './AlertTemplates';
import WebhookSubscriptions from './WebhookSubscriptions';

const TAB_CHANNELS = 'channels';
const TAB_TEMPLATES = 'templates';
const TAB_WEBHOOKS = 'webhooks';

export default function NotificationSettings({ isDark }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState(TAB_CHANNELS);

  const { data: settingsData, isLoading: loadingSettings } = trpc.notifications.settings.useQuery(undefined, { refetchOnWindowFocus: false });
  const { data: webhooksData, isLoading: loadingWebhooks } = useWebhooks();

  const [settings, setSettings] = useState({
    email: '', slackWebhook: '', teamsWebhook: '',
    enabledSlaEmail: false, enabledSlaSlack: false, enabledSlaTeams: false,
    emailTemplate: '', slackTemplate: '', teamsTemplate: '',
  });

  useEffect(() => {
    if (settingsData?.data) {
      const d = settingsData.data;
      setSettings({
        email: d.email || '', slackWebhook: d.slack_webhook || '', teamsWebhook: d.teams_webhook || '',
        enabledSlaEmail: !!d.enabled_sla_email, enabledSlaSlack: !!d.enabled_sla_slack, enabledSlaTeams: !!d.enabled_sla_teams,
        emailTemplate: d.email_template || '', slackTemplate: d.slack_template || '', teamsTemplate: d.teams_template || '',
      });
    }
  }, [settingsData]);

  const saveMutation = useSaveNotificationSettings();
  const saveTemplatesMutation = useSaveAlertTemplates();
  const testMutation = useTestNotificationWebhook();
  const createWebhookMutation = useCreateWebhook();
  const updateWebhookMutation = useUpdateWebhook();
  const deleteWebhookMutation = useDeleteWebhook();

  const handleSaveChannels = async () => {
    try {
      await saveMutation.mutateAsync({
        email: settings.email, slackWebhook: settings.slackWebhook, teamsWebhook: settings.teamsWebhook,
        enabledSlaEmail: settings.enabledSlaEmail, enabledSlaSlack: settings.enabledSlaSlack, enabledSlaTeams: settings.enabledSlaTeams,
      });
      showToast(t('notifications.settingsSaved'), 'success');
    } catch (err) {
      showToast(t('notifications.saveError'), 'error');
    }
  };

  const handleSaveTemplates = async (templates) => {
    try {
      await saveTemplatesMutation.mutateAsync({
        emailTemplate: templates.emailTemplate || null,
        slackTemplate: templates.slackTemplate || null,
        teamsTemplate: templates.teamsTemplate || null,
      });
      showToast(t('notifications.templatesSaved'), 'success');
    } catch (err) {
      showToast(t('notifications.saveError'), 'error');
    }
  };

  const tabStyle = (tab) => ({
    padding: '10px 20px',
    cursor: 'pointer',
    borderBottom: activeTab === tab ? '2px solid #3B82F6' : '2px solid transparent',
    color: activeTab === tab ? '#3B82F6' : isDark ? '#94a3b8' : '#6b7280',
    fontWeight: activeTab === tab ? 600 : 400,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  });

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        <Bell size={24} /> {t('notifications.title')}
      </h2>

      <div style={{ display: 'flex', borderBottom: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, marginBottom: '24px' }}>
        <button style={tabStyle(TAB_CHANNELS)} onClick={() => setActiveTab(TAB_CHANNELS)}>
          <Settings size={16} /> {t('notifications.tabs.channels')}
        </button>
        <button style={tabStyle(TAB_TEMPLATES)} onClick={() => setActiveTab(TAB_TEMPLATES)}>
          <FileText size={16} /> {t('notifications.tabs.templates')}
        </button>
        <button style={tabStyle(TAB_WEBHOOKS)} onClick={() => setActiveTab(TAB_WEBHOOKS)}>
          <Webhook size={16} /> {t('notifications.tabs.webhooks')}
        </button>
      </div>

      {loadingSettings || loadingWebhooks ? (
        <p>{t('common.loading')}</p>
      ) : (
        <>
          {activeTab === TAB_CHANNELS && (
            <NotificationChannels
              isDark={isDark}
              settings={settings}
              setSettings={setSettings}
              onSave={handleSaveChannels}
              savePending={saveMutation.isPending}
              onTest={(channel) => testMutation.mutateAsync({ channel, url: channel === 'slack' ? settings.slackWebhook : settings.teamsWebhook })}
            />
          )}
          {activeTab === TAB_TEMPLATES && (
            <AlertTemplates
              isDark={isDark}
              templates={{
                emailTemplate: settings.emailTemplate,
                slackTemplate: settings.slackTemplate,
                teamsTemplate: settings.teamsTemplate,
              }}
              onSave={handleSaveTemplates}
              savePending={saveTemplatesMutation.isPending}
            />
          )}
          {activeTab === TAB_WEBHOOKS && (
            <WebhookSubscriptions
              isDark={isDark}
              subscriptions={webhooksData?.data || []}
              onCreate={(data) => createWebhookMutation.mutateAsync(data)}
              onUpdate={(id, data) => updateWebhookMutation.mutateAsync({ id, ...data })}
              onDelete={(id) => deleteWebhookMutation.mutateAsync({ id })}
            />
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/NotificationChannels.tsx frontend/src/components/NotificationSettings.tsx
git commit -m "feat(P24): refactor NotificationSettings into tabs with extracted NotificationChannels"
```

---

## Task 8: AlertTemplates Component + Tests

**Files:**

- Create: `frontend/src/components/AlertTemplates.tsx`
- Create: `frontend/src/components/AlertTemplates.test.tsx`

- [ ] **Step 1: Créer AlertTemplates.tsx**

```typescript
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, RotateCcw, Eye } from 'lucide-react';

const VARIABLES = ['metric', 'value', 'threshold', 'severity', 'projectName', 'timestamp'];

export default function AlertTemplates({ isDark, templates, onSave, savePending }) {
  const { t } = useTranslation();
  const [local, setLocal] = useState({
    emailTemplate: templates.emailTemplate || '',
    slackTemplate: templates.slackTemplate || '',
    teamsTemplate: templates.teamsTemplate || '',
  });

  const previewVars = {
    metric: 'passRate',
    value: '87.5',
    threshold: '90',
    severity: 'critical',
    projectName: 'Projet Alpha',
    timestamp: new Date().toISOString(),
  };

  const replaceVars = (text) => {
    return text
      .replace(/\{\{metric\}\}/g, previewVars.metric)
      .replace(/\{\{value\}\}/g, previewVars.value)
      .replace(/\{\{threshold\}\}/g, previewVars.threshold)
      .replace(/\{\{severity\}\}/g, previewVars.severity)
      .replace(/\{\{projectName\}\}/g, previewVars.projectName)
      .replace(/\{\{timestamp\}\}/g, previewVars.timestamp);
  };

  const cardStyle = {
    backgroundColor: isDark ? '#1e293b' : '#f9fafb',
    border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '16px',
  };

  const textareaStyle = {
    width: '100%',
    minHeight: '120px',
    padding: '10px',
    borderRadius: '6px',
    border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`,
    backgroundColor: isDark ? '#0f172a' : '#fff',
    color: isDark ? '#f1f5f9' : '#1f2937',
    fontFamily: 'monospace',
    fontSize: '0.875rem',
    resize: 'vertical',
  };

  const previewStyle = {
    padding: '12px',
    borderRadius: '6px',
    backgroundColor: isDark ? '#0f172a' : '#fff',
    border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`,
    minHeight: '80px',
    whiteSpace: 'pre-wrap',
  };

  const renderSection = (label, key) => (
    <div style={cardStyle} key={key}>
      <h3 style={{ marginTop: 0, marginBottom: '12px' }}>{label}</h3>
      <textarea
        style={textareaStyle}
        value={local[key]}
        onChange={(e) => setLocal({ ...local, [key]: e.target.value })}
        placeholder={t('notifications.templatePlaceholder')}
      />
      <div style={{ marginTop: '12px' }}>
        <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <Eye size={14} /> {t('notifications.preview')}
        </strong>
        <div style={previewStyle}>{replaceVars(local[key]) || t('notifications.noPreview')}</div>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{t('notifications.availableVariables')}:</span>
        {VARIABLES.map((v) => (
          <button
            key={v}
            className="btn-toggle"
            onClick={() => {
              // Insérer {{v}} dans le textarea actif — simplifié: on ne gère pas le focus
            }}
            type="button"
            style={{ fontSize: '0.75rem', padding: '4px 8px' }}
          >
            {'{{' + v + '}}'}
          </button>
        ))}
      </div>

      {renderSection(t('notifications.emailTemplate'), 'emailTemplate')}
      {renderSection(t('notifications.slackTemplate'), 'slackTemplate')}
      {renderSection(t('notifications.teamsTemplate'), 'teamsTemplate')}

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          className="btn-toggle"
          onClick={() => onSave(local)}
          disabled={savePending}
          type="button"
          style={{ backgroundColor: '#10B981', color: '#fff', border: 'none' }}
        >
          <Save size={16} />
          {savePending ? t('common.saving') : t('common.save')}
        </button>
        <button
          className="btn-toggle"
          onClick={() => setLocal({ emailTemplate: '', slackTemplate: '', teamsTemplate: '' })}
          type="button"
        >
          <RotateCcw size={16} />
          {t('common.reset')}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Créer AlertTemplates.test.tsx**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AlertTemplates from './AlertTemplates';

describe('AlertTemplates', () => {
  it('renders 3 template sections', () => {
    render(<AlertTemplates isDark={false} templates={{}} onSave={vi.fn()} savePending={false} />);
    expect(screen.getByPlaceholderText(/templatePlaceholder/i)).toBeInTheDocument();
  });

  it('updates local state on textarea change', () => {
    render(<AlertTemplates isDark={false} templates={{ emailTemplate: '' }} onSave={vi.fn()} savePending={false} />);
    const textarea = screen.getAllByRole('textbox')[0];
    fireEvent.change(textarea, { target: { value: 'Hello {{metric}}' } });
    expect(textarea).toHaveValue('Hello {{metric}}');
  });

  it('shows preview with replaced variables', () => {
    render(<AlertTemplates isDark={false} templates={{ emailTemplate: '{{metric}} = {{value}}%' }} onSave={vi.fn()} savePending={false} />);
    expect(screen.getByText(/passRate = 87.5%/)).toBeInTheDocument();
  });

  it('calls onSave with templates', () => {
    const onSave = vi.fn();
    render(<AlertTemplates isDark={false} templates={{ emailTemplate: 'Test' }} onSave={onSave} savePending={false} />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ emailTemplate: 'Test' }));
  });
});
```

- [ ] **Step 3: Run frontend tests**

Run: `cd frontend && npx vitest run src/components/AlertTemplates.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AlertTemplates.tsx frontend/src/components/AlertTemplates.test.tsx
git commit -m "feat(P24): add AlertTemplates component with live preview and tests"
```

---

## Task 9: WebhookSubscriptions Component + Tests

**Files:**

- Create: `frontend/src/components/WebhookSubscriptions.tsx`
- Create: `frontend/src/components/WebhookSubscriptions.test.tsx`

- [ ] **Step 1: Créer WebhookSubscriptions.tsx**

```typescript
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Edit2, Check, X, Webhook } from 'lucide-react';

const EVENTS = ['feature-flag.changed', 'metric.alert'];
const METRICS = ['completionRate', 'passRate', 'failureRate', 'blockedRate', 'escapeRate', 'detectionRate', 'testEfficiency'];
const SEVERITIES = ['warning', 'critical'];

export default function WebhookSubscriptions({ isDark, subscriptions, onCreate, onUpdate, onDelete }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ url: '', events: [], secret: '', filters: null });

  const cardStyle = {
    backgroundColor: isDark ? '#1e293b' : '#f9fafb',
    border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '6px',
    border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`,
    backgroundColor: isDark ? '#0f172a' : '#fff',
    color: isDark ? '#f1f5f9' : '#1f2937',
    marginBottom: '8px',
  };

  const startEdit = (sub = null) => {
    if (sub) {
      setEditing(sub.id);
      setForm({ url: sub.url, events: sub.events, secret: sub.secret, filters: sub.filters });
    } else {
      setEditing('new');
      setForm({ url: '', events: ['metric.alert'], secret: '', filters: { metric: '', severity: '' } });
    }
  };

  const save = async () => {
    const data = {
      url: form.url,
      events: form.events,
      secret: form.secret,
      filters: form.events.includes('metric.alert') && form.filters ? {
        metric: form.filters.metric || undefined,
        severity: form.filters.severity || undefined,
      } : null,
    };
    if (editing === 'new') {
      await onCreate(data);
    } else {
      await onUpdate(editing, data);
    }
    setEditing(null);
  };

  const showFilters = form.events.includes('metric.alert');

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <button className="btn-toggle" onClick={() => startEdit()} type="button">
          <Plus size={16} /> {t('webhooks.add')}
        </button>
      </div>

      {editing === 'new' && (
        <div style={{ ...cardStyle, display: 'block' }}>
          <input style={inputStyle} placeholder="URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          <select multiple style={inputStyle} value={form.events} onChange={(e) => {
            const opts = Array.from(e.target.selectedOptions).map(o => o.value);
            setForm({ ...form, events: opts });
          }}>
            {EVENTS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          {showFilters && (
            <>
              <select style={inputStyle} value={form.filters?.metric || ''} onChange={(e) => setForm({ ...form, filters: { ...form.filters, metric: e.target.value } })}>
                <option value="">{t('webhooks.allMetrics')}</option>
                {METRICS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select style={inputStyle} value={form.filters?.severity || ''} onChange={(e) => setForm({ ...form, filters: { ...form.filters, severity: e.target.value } })}>
                <option value="">{t('webhooks.allSeverities')}</option>
                {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </>
          )}
          <input style={inputStyle} type="password" placeholder="Secret" value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} />
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button className="btn-toggle" onClick={save}><Check size={16} /></button>
            <button className="btn-toggle" onClick={() => setEditing(null)}><X size={16} /></button>
          </div>
        </div>
      )}

      {subscriptions.map((sub) => (
        <div key={sub.id} style={cardStyle}>
          {editing === sub.id ? (
            <div style={{ width: '100%' }}>
              <input style={inputStyle} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
              <select multiple style={inputStyle} value={form.events} onChange={(e) => {
                const opts = Array.from(e.target.selectedOptions).map(o => o.value);
                setForm({ ...form, events: opts });
              }}>
                {EVENTS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              {showFilters && (
                <>
                  <select style={inputStyle} value={form.filters?.metric || ''} onChange={(e) => setForm({ ...form, filters: { ...form.filters, metric: e.target.value } })}>
                    <option value="">{t('webhooks.allMetrics')}</option>
                    {METRICS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select style={inputStyle} value={form.filters?.severity || ''} onChange={(e) => setForm({ ...form, filters: { ...form.filters, severity: e.target.value } })}>
                    <option value="">{t('webhooks.allSeverities')}</option>
                    {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </>
              )}
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button className="btn-toggle" onClick={save}><Check size={16} /></button>
                <button className="btn-toggle" onClick={() => setEditing(null)}><X size={16} /></button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Webhook size={14} /> {sub.url}
                </div>
                <div style={{ fontSize: '0.8rem', color: isDark ? '#94a3b8' : '#6b7280', marginTop: '4px' }}>
                  {sub.events.join(', ')}
                  {sub.filters && (
                    <span> | {JSON.stringify(sub.filters)}</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-toggle" onClick={() => startEdit(sub)}><Edit2 size={14} /></button>
                <button className="btn-toggle" onClick={() => onDelete(sub.id)}><Trash2 size={14} /></button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Créer WebhookSubscriptions.test.tsx**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WebhookSubscriptions from './WebhookSubscriptions';

describe('WebhookSubscriptions', () => {
  const subs = [
    { id: 1, url: 'http://hook1', events: ['metric.alert'], enabled: true, filters: { metric: 'passRate' }, secret: 's1' },
  ];

  it('renders subscriptions list', () => {
    render(<WebhookSubscriptions isDark={false} subscriptions={subs} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('http://hook1')).toBeInTheDocument();
  });

  it('shows add form when clicking add', () => {
    render(<WebhookSubscriptions isDark={false} subscriptions={[]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(screen.getByPlaceholderText('URL')).toBeInTheDocument();
  });

  it('calls onDelete when clicking delete', () => {
    const onDelete = vi.fn();
    render(<WebhookSubscriptions isDark={false} subscriptions={subs} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 3: Run frontend tests**

Run: `cd frontend && npx vitest run src/components/WebhookSubscriptions.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/WebhookSubscriptions.tsx frontend/src/components/WebhookSubscriptions.test.tsx
git commit -m "feat(P24): add WebhookSubscriptions component with metric/severity filters and tests"
```

---

## Task 10: Tests E2E

**Files:**

- Create: `e2e/alerting-advanced.spec.js`

- [ ] **Step 1: Créer le test E2E**

```javascript
const { test, expect } = require('@playwright/test');

test.describe('P24 — Alerting avancé', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/?$/);
    await page.goto('/notifications');
  });

  test('navigation entre les onglets de notifications', async ({ page }) => {
    await expect(page.locator('text=Paramètres')).toBeVisible();
    await page.click('text=Templates');
    await expect(page.locator('text=Email')).toBeVisible();
    await page.click('text=Webhooks');
    await expect(page.locator('text=Ajouter')).toBeVisible();
  });

  test('créer un webhook avec filtre métrique', async ({ page }) => {
    await page.click('text=Webhooks');
    await page.click('text=Ajouter');
    await page.fill('input[placeholder="URL"]', 'http://localhost:9999/webhook');
    await page.selectOption('select[multiple]', ['metric.alert']);
    await page.selectOption('select:has-text("allMetrics")', 'passRate');
    await page.fill('input[type="password"]', 'secret123');
    await page.click('button:has([data-lucide="check"])');
    await expect(page.locator('text=http://localhost:9999/webhook')).toBeVisible();
  });
});
```

- [ ] **Step 2: Run E2E tests**

Run: `cd e2e && npx playwright test alerting-advanced.spec.js`
Expected: PASS (ou skipped si pas de serveur, mais au moins pas d'erreur de syntaxe)

- [ ] **Step 3: Commit**

```bash
git add e2e/alerting-advanced.spec.js
git commit -m "test(P24): add E2E tests for advanced alerting"
```

---

## Task 11: Build + Typecheck + ROADMAP + Finalisation

**Files:**

- Modify: `ROADMAP.md`

- [ ] **Step 1: Build frontend**

Run: `cd frontend && npm run build`
Expected: Build réussit sans erreur

- [ ] **Step 2: Typecheck backend**

Run: `cd backend && npx tsc --noEmit`
Expected: 0 erreur

- [ ] **Step 3: Run all tests**

Run:

```bash
cd backend && npx jest --no-coverage
cd ../frontend && npx vitest run
cd ../e2e && npx playwright test
```

Expected: Tous les tests passent

- [ ] **Step 4: Mettre à jour ROADMAP.md**

Remplacer la ligne P24 par:

```markdown
- [x] **P24** — Alerting avancé : webhooks personnalisés par métrique, templates d'alerte configurables
```

- [ ] **Step 5: Commit final**

```bash
git add ROADMAP.md
git commit -m "docs(P24): mark P24 as complete in ROADMAP"
```

- [ ] **Step 6: Push**

```bash
git push origin main
```
