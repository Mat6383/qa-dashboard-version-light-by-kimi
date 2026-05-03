# Plan de migration : React Query → TypeScript

> Objectif : intégrer l'Option B (Performance) et l'Option C (DX) de manière séquentielle et sans friction.

---

## Résumé exécutif

| Phase | Cible    | Technologie             | Fichiers concernés (est.)    | Valeur immédiate                         |
| ----- | -------- | ----------------------- | ---------------------------- | ---------------------------------------- |
| 1     | Frontend | React Query + cache     | ~27 fichiers (data fetching) | Perf UX++, -useEffect, -requêtes réseau  |
| 2     | Backend  | TypeScript + Zod inféré | ~99 fichiers (progressif)    | Robustesse API, types auto-générés       |
| 3     | Frontend | TypeScript progressif   | ~80 fichiers (progressif)    | DX++, sécurité types, autocomplétion API |

**Pourquoi cet ordre ?**

1. React Query en **JS pur** élimine la dette `useEffect`/`useState` avant d'ajouter la complexité des types.
2. Le **backend Zod** fournit une base de types inférés qu'on peut exposer au frontend (OpenAPI / tRPC-like).
3. Le **frontend TS** en dernier bénéficie des hooks `useQuery` déjà typés et des contrats API définis.

---

## Phase 1 — React Query sur le Frontend (Option B)

### 1.1 Installation & Setup

```bash
cd frontend
npm install @tanstack/react-query @tanstack/react-query-devtools
```

- Créer `src/lib/queryClient.js` : config `QueryClient` (`staleTime`, `cacheTime`, retries, refetch policies).
- Wrapper l'app dans `<QueryClientProvider>`.
- Activer les devtools en dev uniquement.

### 1.2 Stratégie de migration

**Approche par hooks**, pas par composants.

Le fichier `api.service.js` contient déjà ~40 méthodes axios bien structurées. On ne le supprime pas : on en fait la couche `queryFn` / `mutationFn`.

Exemple de transformation :

```js
// avant
const [projects, setProjects] = useState([]);
useEffect(() => {
  apiService.getProjects().then(setProjects);
}, []);

// après
const { data: projects } = useQuery({
  queryKey: ['projects'],
  queryFn: () => apiService.getProjects(),
  staleTime: 5 * 60 * 1000,
});
```

### 1.3 Hooks custom à créer

Créer `src/hooks/queries/` et `src/hooks/mutations/` :

- `useProjects()`
- `useDashboardMetrics(projectId, ...)`
- `useSyncHistory()`
- `useGenerateReport()` (mutation)
- `useFeatureFlagsAdmin()`
- etc.

**Règle d'or** : chaque méthode `apiService.xxx()` qui fait un GET devient un `useQuery`. Chaque POST/PUT/DELETE devient un `useMutation` avec invalidation de cache (`queryClient.invalidateQueries`).

### 1.4 Gestion du cache & invalidation

| Domaine       | `queryKey`                            | Invalidation               |
| ------------- | ------------------------------------- | -------------------------- |
| Projets       | `['projects']`                        | Après création/maj         |
| Dashboard     | `['dashboard', projectId, ...params]` | Après sync, maj milestones |
| Sync          | `['sync', 'history']`                 | Après exécution sync       |
| Feature flags | `['feature-flags']`                   | Après admin update         |

### 1.5 Spécificités

- **SSE / Streaming** (`useSyncProgress`) : garder le hook custom. React Query ne gère pas nativement les streams. On peut wrapper l'état final en `useQuery` si besoin.
- **Axios vs Fetch** : on garde `api.service.js` + axios. React Query s'en fiche de la lib HTTP.
- **AbortController** : React Query gère l'annulation automatiquement si `queryFn` renvoie une Promise axios (signal supporté).

### 1.6 Critères de succès

- [ ] Zero `useEffect` utilisé pour du data fetching (sauf SSE).
- [ ] `api.service.js` reste la source unique de vérité des appels HTTP.
- [ ] Les dashboards se rechargent moins souvent (cache actif, SWR).
- [ ] Les mutations invalident proprement les queries liées.

---

## Phase 2 — TypeScript sur le Backend (Option C — partie 1)

### 2.1 Prérequis

Le backend utilise déjà **Zod** (`validators/index.js`, `services/...`). C'est un atout majeur : on n'a pas à réécrire les schémas, juste à en inférer les types.

### 2.2 Setup TS

```bash
cd backend
npm install -D typescript @types/node @types/express
npx tsc --init
```

- `tsconfig.json` : `"allowJs": true`, `"checkJs": false` (migration progressive), `"outDir": "dist"`.
- Adapter `package.json` : script `build` et `start`.

### 2.3 Migration progressive (fichier par fichier)

Ordre de priorité (du plus isolé au plus critique) :

1. `validators/` → ajouter `z.infer<typeof Schema>` dans un fichier `types.ts`.
2. `utils/` → fonctions pures, faciles à typer.
3. `services/` → typer les retours des fonctions avec les types Zod inférés.
4. `routes/` → typer les `req`, `res` via les types Express + Zod.
5. `middleware/` → dernier, touche au cycle requête/réponse.

### 2.4 Génération de types API pour le frontend

Deux options (à décider au moment venu) :

**Option A — OpenAPI + codegen**

- Générer un `openapi.yaml` depuis les routes Express + Zod (via `zod-to-openapi` ou manuel).
- Utiliser `openapi-typescript` pour générer `api-types.ts` côté frontend.

**Option B — Types partagés (monorepo light)**

- Créer un dossier `shared/types/` à la racine du repo.
- Y exporter les `z.infer<...>` du backend.
- Le frontend importe ces types (JS → TS, puis quand le frontend est TS aussi).

> **Recommandation** : Option B plus simple pour ce repo, car pas de publication de package. On peut symlink ou simplement copier le fichier de types généré lors du build.

### 2.5 Critères de succès

- [ ] `validators/index.js` exporte des types TypeScript inférés de Zod.
- [ ] Toute nouvelle route/service est écrit en TS.
- [ ] Le build backend passe (`tsc --noEmit` au minimum sur les fichiers `.ts`).
- [ ] Un fichier de types API est consommable par le frontend.

---

## Phase 3 — TypeScript sur le Frontend (Option C — partie 2)

### 3.1 Setup TS

Vite supporte TS nativement. Pas de changement de bundler.

```bash
cd frontend
npm install -D typescript @types/react @types/react-dom
npx tsc --init
```

- `tsconfig.json` : `"jsx": "react-jsx"`, `"allowJs": true`, `"checkJs": false`.
- Renommer `vite.config.js` → `vite.config.ts` (optionnel mais propre).

### 3.2 Ordre de migration

1. **`src/services/api.service.js`** → `.ts`
   - Typer les params et retours avec les types API générés en Phase 2.
   - C'est le fichier le plus important car tout le monde en dépend.

2. **`src/hooks/queries/*`** → `.ts`
   - Les `useQuery` et `useMutation` deviennent génériques naturellement.
   - Exemple : `useQuery<Project[]>({ queryKey: ['projects'], ... })`.

3. **`src/contexts/*`** → `.ts`
   - Les contexts ont souvent des types de state complexes.

4. **`src/components/*`** → `.ts` / `.tsx`
   - Commencer par les composants "feuilles" (pas de props complexes).
   - Finir par les dashboards et modals (props lourdes).

### 3.3 Stratégie

- **Fichier par fichier**, pas de "big bang".
- Renommer `.jsx` → `.tsx` quand on touche un fichier.
- Garder `allowJs: true` jusqu'à ce que 100% des fichiers soient en TS.
- Utiliser `// @ts-check` dans les fichiers JS restants pour activer l'analyse progressivement.

### 3.4 Critères de succès

- [ ] `api.service.ts` est fully typed avec les contrats backend.
- [ ] Zero `any` implicite sur les nouveaux fichiers.
- [ ] Le build Vite passe sans erreur TS.
- [ ] Les hooks React Query sont génériquement typés (`data` est inféré, pas `unknown`).

---

## Dépendances entre les phases

```
Phase 1 (React Query)
        │
        ▼
Phase 2 (TS Backend) ──types API──► Phase 3 (TS Frontend)
```

**On peut démarrer la Phase 2 dès que les principaux hooks React Query sont en place** (pas besoin d'attendre la fin de la Phase 1). Par contre, la Phase 3 dépend de la Phase 2 pour avoir les types API.

---

## Estimation de charge (indicatif)

| Phase     | Tâches                                             | Charge estimée                                    |
| --------- | -------------------------------------------------- | ------------------------------------------------- |
| 1         | Setup RQ + ~15-20 hooks + invalidation cache       | 1-2 jours                                         |
| 2         | Setup TS + validators types + services + routes    | 2-3 jours                                         |
| 3         | Setup TS + api.service.ts + composants progressifs | 3-5 jours                                         |
| **Total** |                                                    | **6-10 jours** (en mode progressif, pas bloquant) |

---

## Risques & Mitigations

| Risque                                  | Mitigation                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------ |
| Régression data fetching en migrant RQ  | Garder `api.service.js` intact au début ; RQ est une couche par-dessus. Tests E2E passent. |
| Build TS casse le déploiement           | `allowJs: true` + `checkJs: false` ; activer `noEmit` d'abord.                             |
| Zod schemas incomplets pour l'inférence | Auditer `validators/index.js` avant la Phase 2 ; compléter les schémas si besoin.          |
| Fuite de mémoire avec RQ (cache)        | Configurer `cacheTime` / `staleTime` par domaine ; pas de `Infinity` par défaut.           |

---

## Prochaines étapes immédiates

1. **Valider ce plan** (ce document).
2. **Décider** : veut-on commencer par la Phase 1 tout de suite ?
3. **Si oui** : créer une branche `feat/react-query`, installer les deps, et implémenter le setup + 3-5 hooks pilotes.
