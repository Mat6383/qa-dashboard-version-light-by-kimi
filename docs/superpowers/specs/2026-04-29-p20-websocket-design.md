# Spec P20 — WebSocket temps réel

> Date : 2026-04-29  
> Scope : Ajouter un serveur WebSocket (`ws`) pour remplacer/améliorer le SSE dashboard avec polling centralisé, et préparer le terrain pour les syncs bidirectionnelles. Le SSE existant reste fonctionnel (coexistence).

---

## Contexte

Le SSE dashboard actuel (`GET /api/dashboard/:projectId/stream`) fonctionne mais présente deux limites critiques :

1. **Long-polling côté serveur** : chaque client connecté déclenche son propre `setInterval(30s)` qui interroge Testmo. 10 onglets = 10 requêtes Testmo toutes les 30s.
2. **Pas de gestion centralisée** : pas de broadcast partagé, pas de "room" par projet.

Les endpoints sync (`POST /sync/execute`, `/sync/status-to-gitlab`) utilisent un hack `fetch+ReadableStream` car `EventSource` ne supporte pas POST.

---

## Objectifs

1. **Centraliser le polling** : UN seul `setInterval` par `projectId` côté serveur, broadcast à tous les clients WebSocket de la room
2. **Unifier le transport** : Dashboard + Sync utilisent le même canal WebSocket
3. **Fallback transparent** : si WS indisponible, retour automatique sur SSE après 3s
4. **Pas de breaking change** : routes SSE existantes conservées
5. **Heartbeat natif** : ping/pong toutes les 15s pour détecter les clients morts

---

## Architecture

### Backend — WebSocket Server (`ws`)

```
Express HTTP Server (port 3001)
    │
    ├── Upgrade request ──▶ WS Server (/ws)
    │
    ├── GET /api/dashboard/:projectId/stream  (SSE legacy — conservé)
    ├── POST /api/sync/execute               (SSE legacy — conservé)
    └── ... autres routes HTTP

WS Server
    │
    ├── /ws/dashboard?projectId=123
    │       │
    │       └── DashboardRoom (projectId=123)
    │               ├── clients: Set<WebSocket>
    │               ├── startPolling() → setInterval(30s)
    │               │                       │
    │               │                       ▼
    │               │               testmoService.getProjectMetrics()
    │               │               compare hash
    │               │                       │
    │               │                       ▼
    │               │               broadcast({ type: 'metrics', payload })
    │               └── stopPolling() (quand dernier client quitte)
    │
    └── /ws/sync (future — P20#2)
            └── SyncHandler
```

### Frontend — Hook avec fallback

```
useDashboardWebSocket({ projectId, enabled })
    │
    ├── Phase 1 : new WebSocket('ws://host/ws/dashboard?projectId=123')
    │       ├── onopen    → setTransport('ws')
    │       ├── onmessage → setData(payload)
    │       └── onerror   → ws.close() → Phase 2 (fallback)
    │
    └── Phase 2 (fallback) : startSSEFallback()
            └── useDashboardSSE() (existant)
```

---

## Protocole de messages (JSON)

### Client → Serveur

| Type        | Payload                                              | Description                        |
| ----------- | ---------------------------------------------------- | ---------------------------------- |
| `subscribe` | `{ projectId, preprodMilestones?, prodMilestones? }` | S'abonne aux métriques d'un projet |

### Serveur → Client

| Type      | Payload                                | Description                 |
| --------- | -------------------------------------- | --------------------------- |
| `metrics` | `{ metrics, qualityRates, timestamp }` | Métriques mises à jour      |
| `error`   | `{ message }`                          | Erreur backend              |
| `pong`    | `{ timestamp }`                        | Réponse au heartbeat client |

---

## API / Interface

### Backend

```ts
// backend/websocket/dashboard.room.ts
class DashboardRoom {
  constructor(projectId: number, milestones?: Milestones);
  addClient(ws: WebSocket): void;
  removeClient(ws: WebSocket): void;
  private startPolling(): void;
  private stopPolling(): void;
  private async fetchAndBroadcast(): Promise<void>;
  private broadcast(msg: WSMessage): void;
}

// backend/websocket/index.ts
export function setupWebSocket(server: http.Server): void;
```

### Frontend

```ts
// frontend/src/hooks/useDashboardWebSocket.ts
export function useDashboardWebSocket(options: {
  projectId: number;
  preprodMilestones?: string[];
  prodMilestones?: string[];
  enabled?: boolean;
}): {
  connected: boolean;
  connecting: boolean;
  transport: 'ws' | 'sse' | null;
  data: DashboardSSEData | null;
  error: string | null;
};
```

---

## Stratégie de migration (2 vagues)

### P20#1 — Dashboard WebSocket + fallback SSE (cette session)

1. Créer le WS server et la room dashboard
2. Créer `useDashboardWebSocket` avec fallback SSE
3. Modifier `DashboardContext` pour utiliser le nouveau hook
4. Tests backend (room manager) + frontend (hook)
5. Les routes SSE restent fonctionnelles

### P20#2 — Sync via WebSocket (session future)

1. Ajouter `SyncHandler` côté WS
2. Créer `useSyncWebSocket` côté frontend
3. Déprécier progressivement les routes SSE sync

---

## Tests

| Test                                                | Fichier                                            |
| --------------------------------------------------- | -------------------------------------------------- |
| Room crée un seul intervalle pour N clients         | `backend/tests/websocket/dashboard.room.test.ts`   |
| Room détruit l'intervalle quand dernier client part | `backend/tests/websocket/dashboard.room.test.ts`   |
| Broadcast n'envoie que si le hash change            | `backend/tests/websocket/dashboard.room.test.ts`   |
| Hook tente WS puis fallback SSE                     | `frontend/src/hooks/useDashboardWebSocket.test.ts` |
| Context alimente React Query depuis WS              | `frontend/src/hooks/useDashboardWebSocket.test.ts` |

---

## Fichiers impactés (P20#1)

- `backend/websocket/dashboard.room.ts` — Créer
- `backend/websocket/index.ts` — Créer
- `backend/server.ts` — Modifier (intégrer WS)
- `frontend/src/hooks/useDashboardWebSocket.ts` — Créer
- `frontend/src/contexts/DashboardContext.tsx` — Modifier (utiliser nouveau hook)
- `backend/tests/websocket/dashboard.room.test.ts` — Créer
- `frontend/src/hooks/useDashboardWebSocket.test.ts` — Créer

---

## Non-goals

- Pas de suppression du SSE dans cette session
- Pas de Redis (pas de cluster multi-node)
- Pas de Sync via WS dans cette session (P20#2)
- Pas de rooms dynamiques complexes (uniquement par projectId)

---

## Dépendances

- Backend : `ws` (à installer)
- Frontend : aucune (API WebSocket native)
