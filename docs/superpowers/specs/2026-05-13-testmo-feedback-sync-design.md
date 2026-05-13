# Testmo Feedback Sync — Design Spec

## Overview

Quand une issue GitLab est synchronisée comme résultat automation dans Testmo (Routine A), on injecte un template de retour de test dans le custom field **Note** du résultat. Les testeurs remplissent ensuite ce template directement dans Testmo. Un cron backend scanne périodiquement les runs affichés dans Dashboard 4 (préprod + production) et crée automatiquement un ticket GitLab pour chaque résultat dont le template a été rempli. Un onglet dédié dans la page **Outils** permet de lancer le scan manuellement et de consulter l'historique.

## Goals

1. Injecter un template de retour dans le field **Note** de chaque résultat automation poussé vers Testmo.
2. Scanner automatiquement (cron) les runs Testmo de préprod et production pour détecter les notes remplies.
3. Créer un ticket GitLab par retour détecté, avec le bon titre, milestone et label.
4. Éviter les doublons : ne pas recréer un ticket si un ticket GitLab existe déjà pour ce retour.
5. Fournir une UI dans **Outils → Retours Testmo** pour lancer manuellement le scan et voir l'historique.

## Architecture & Data Flow

```
┌─────────────┐     append_test_results      ┌─────────────┐
│  sync_mapper │ ─────────────────────────────►│  Testmo Run │
│  (Routine A) │   injecte field "Note" +     │  (résultat) │
└─────────────┘   template HTML               └─────────────┘
                                                    │
                                                    ▼ (testeurs remplissent)
┌─────────────┐     scan run results            ┌─────────────┐
│  GitLab     │ ◄───────────────────────────────│ feedback_   │
│  (tickets)  │   crée ticket si sections       │ sync_service│
│             │   Base/Version/etc. remplies    │             │
└─────────────┘                                 └─────────────┘
                                                       ▲
                              ┌────────────────────────┘
                              │ cron toutes les 30 min
                              │ ou call API manuel
                              ▼
                        ┌─────────────┐
                        │  Frontend   │
                        │  (Tools)    │
                        └─────────────┘
```

### Backend Components

| Component                  | Responsibility                                                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `sync_mapper.py`           | Ajoute le field `Note` avec le template HTML dans chaque test envoyé à Testmo.                                                         |
| `feedback_sync_service.py` | Orchestre le scan : récupère les runs, leurs résultats, parse le field Note, filtre ceux qui ont des données, crée les tickets GitLab. |
| `feedback_sync_router.py`  | Expose les endpoints : `POST /feedback-sync/run`, `GET /feedback-sync/history`, `GET /feedback-sync/config`.                           |
| `models/feedback_sync.py`  | Table SQLAlchemy `FeedbackSyncRun` pour persister l'historique des scans.                                                              |
| `gitlab.py`                | Méthode `create_issue()` étendue pour créer le ticket avec milestone, labels et description formatée.                                  |

### Frontend Components

| Component                   | Responsibility                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `ToolsPage.tsx`             | Nouvel onglet `feedback-sync` dans les tabs existants.                                                                                  |
| `FeedbackSyncDashboard.tsx` | Dashboard avec : bouton "Lancer le scan", switch "Runs en cours uniquement", tableau d'historique des scans, compteur de tickets créés. |
| `api.service.ts`            | Méthodes `runFeedbackSync()`, `getFeedbackSyncHistory()`.                                                                               |

## Template Format (injecté dans le field Note)

Le field Note est de type HTML (type 4). Le template est envoyé en HTML avec des placeholders visuels.

```html
<h3>Base</h3>
<p>_ _ _</p>

<h3>Version</h3>
<p>_ _ _</p>

<h3>Utilisateur</h3>
<p>ID : _ _ _</p>

<h3>Ressources</h3>
<p>_ _ _</p>

<h3>Comment reproduire</h3>
<p>_ _ _</p>

<h3>Comportement observé</h3>
<p><em>Pensez à ajouter un screenshot / vidéo du bug</em></p>
<p>_ _ _</p>

<h3>Comportement voulu</h3>
<p>_ _ _</p>
```

> Le parseur du cron recherche les sections `## Base`, `## Version`, `## Utilisateur`, `## Ressources`, `## Comment reproduire`, `## Comportement observé`, `## Comportement voulu`. Si au moins une section contient du texte autre que les placeholders `_ _ _` ou `<em>Pensez...</em>`, le résultat est considéré comme "rempli".

## Data Model

```python
class FeedbackSyncRun(Base):
    __tablename__ = "feedback_sync_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    triggered_by: Mapped[str] = mapped_column(default="cron")  # "cron" | "manual"
    project_id: Mapped[int]
    runs_scanned: Mapped[int] = mapped_column(default=0)
    results_checked: Mapped[int] = mapped_column(default=0)
    tickets_created: Mapped[int] = mapped_column(default=0)
    tickets_skipped: Mapped[int] = mapped_column(default=0)
    details: Mapped[list[dict]] = mapped_column(JSON, default=list)
```

## API Endpoints

| Method | Path                         | Description                                                                   |
| ------ | ---------------------------- | ----------------------------------------------------------------------------- |
| `POST` | `/api/feedback-sync/run`     | Lance le scan manuellement. Body: `{ "project_id": 1, "active_only": true }`. |
| `GET`  | `/api/feedback-sync/history` | Retourne l'historique des scans. Query: `?limit=50`.                          |
| `GET`  | `/api/feedback-sync/config`  | Retourne la config cron (intervalle, statut actif/inactif).                   |

## Cron Behavior

- **Fréquence** : toutes les 30 minutes via APScheduler (déjà utilisé dans le projet).
- **Scope** : pour chaque projet configuré, récupère les runs affichés dans Dashboard 4 (préprod + prod) → utilise `testmo_service.get_project_metrics()` ou un appel direct à `/projects/{id}/runs`.
- **Filtrage** : par défaut, ne scanne que les runs **non clos** (`is_closed: false`). Si l'utilisateur lance manuellement avec `active_only: false`, tous les runs sont scannés.
- **Déduplication** : avant de créer un ticket, vérifie dans GitLab qu'aucun ticket n'existe déjà avec le label `TESTMO` et le titre correspondant au cas de test.

## Ticket GitLab Format

| Attribute       | Value                                                                                |
| --------------- | ------------------------------------------------------------------------------------ |
| **Title**       | `{case_name} - Retour`                                                               |
| **Milestone**   | `Version du Turfu`                                                                   |
| **Labels**      | `TESTMO`                                                                             |
| **Description** | Contenu du field Note copié tel quel (HTML → Markdown si possible, sinon HTML brut). |

## Error Handling

- Si l'API Testmo est indisponible lors du scan : le scan échoue, log d'erreur, pas de tickets créés. Le prochain cron réessaiera.
- Si la milestone `Version du Turfu` n'existe pas dans GitLab : log warning, ticket créé sans milestone.
- Si le label `TESTMO` n'existe pas dans GitLab : log warning, ticket créé sans label.
- Si un ticket existe déjà (détection par titre + label) : skip, incrémente `tickets_skipped`.

## Testing Strategy

- **Unit tests** : parser du template (`_is_template_filled`), détection de doublons (`_ticket_exists`), construction du payload GitLab.
- **Integration tests** : mock des appels Testmo et GitLab, vérifier qu'un scan déclenche bien la création de ticket.
- **E2E** : vérifier que le frontend affiche bien l'historique après un scan manuel.

## Out of Scope

- Pas de modification du template côté frontend (hardcodé pour l'instant).
- Pas de notification en temps réel (pas de WebSocket/SSE pour cette feature).
- Pas d'édition des tickets GitLab existants si le template est modifié dans Testmo.
