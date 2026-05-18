# Design — Toggle "Tests exploratoires par milestone" dans Dashboard4

**Date** : 2026-05-18  
**Scope** : Frontend only (React / TypeScript)  
**Auteur** : Kimi Code CLI (brainstorming skill)

---

## 1. Objectif

Ajouter un interrupteur (toggle) dans la section **Campagnes Actives (Préproduction)** du Dashboard4, à côté du toggle existant _"Dernier actif / Latest only"_.  
Quand il est activé, il affiche **en plus** les runs marqués comme exploratoires (`isExploratory === true`) qui sont liés aux milestones préprod actuellement sélectionnées (`selectedPreprodMilestones`). Ces runs exploratoires ne sont pas soumis à la limite de pagination (8/12 cartes).

---

## 2. Contexte actuel

- Le backend retourne déjà `"milestone": run.get("milestone_id")` pour chaque run, mais le type TypeScript `Run` ne l'expose pas encore.
- Les runs avec `isExploratory: true` existent déjà dans la codebase (typage, composants, styles) mais ne sont pas produits par le backend actuel (`testmo_metrics.py` met toujours `False`). Ce design prépare le frontend pour les recevoir quand le backend les fournira.
- Le tri actuel dans `Dashboard4` place les exploratoires à la fin : `sort((a, b) => (a.isExploratory ? 1 : 0) - (b.isExploratory ? 1 : 0))`.
- La pagination dans `CampaignGrid` limite l'affichage à 8 ou 12 runs selon `showAllRuns`.

---

## 3. Architecture & Data Flow

```
Dashboard4
├── État local : showExploratoryByMilestone (boolean, défaut false)
├── Props reçues : selectedPreprodMilestones (number[])
├── Computed : displayedRuns
│   ├── Étape 1 — base :
│   │   showLatestOnly && latestRun  → [latestRun non-exploratoire]
│   │   sinon                        → sortedRuns (normaux + exploratoires, triés)
│   └── Étape 2 — merge exploratoires (si toggle ON) :
│       exploratory = runs.filter(
│         r => r.isExploratory
│                && selectedPreprodMilestones.includes(r.milestone)
│       )
│       Dédoublonnage par ID, puis concaténation : base + exploratory
│       (les exploratoires restent en fin de liste)
└── Props passées à PreprodSection → CampaignGrid
    ├── sortedRuns (= displayedRuns)
    ├── showExploratoryByMilestone
    └── setShowExploratoryByMilestone
```

**Règle de pagination dans CampaignGrid :**

- Séparer `visibleRuns` en deux groupes : `normalRuns` (non-exploratoires ou hors scope) et `exploratoryRuns` (dans scope + toggle ON).
- Paginer **uniquement** `normalRuns` selon la limite existante.
- Concaténer `exploratoryRuns` en fin de liste, sans limite.

---

## 4. Modifications par fichier

### 4.1 `frontend/src/types/api.types.ts`

Ajouter le champ manquant à l'interface `Run` :

```ts
export interface Run {
  id: number | string;
  name: string;
  total: number;
  completed: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  wip: number;
  untested: number;
  completionRate: number;
  passRate: number;
  isExploratory: boolean;
  isClosed: boolean;
  created_at: string;
  milestone?: number; // ← AJOUT
}
```

### 4.2 `frontend/src/components/Dashboard4.tsx`

1. **Nouvel état** (ligne ~83) :

   ```ts
   const [showExploratoryByMilestone, setShowExploratoryByMilestone] = React.useState(false);
   ```

2. **Recalcul de `displayedRuns`** (remplace les lignes 113-116) :

   ```ts
   const displayedRuns = useMemo(() => {
     let base = showLatestOnly && latestRun ? [latestRun] : sortedRuns;
     if (showExploratoryByMilestone && selectedPreprodMilestones.length > 0) {
       const exploratory = sortedRuns.filter(
         (r) =>
           r.isExploratory &&
           selectedPreprodMilestones.includes((r as Run & { milestone?: number }).milestone as number) &&
           !base.some((br) => br.id === r.id)
       );
       base = [...base, ...exploratory];
     }
     return base;
   }, [showLatestOnly, latestRun, sortedRuns, showExploratoryByMilestone, selectedPreprodMilestones]);
   ```

3. **Forward des props** à `<PreprodSection>` (lignes ~286-291) :
   ```tsx
   showExploratoryByMilestone = { showExploratoryByMilestone };
   setShowExploratoryByMilestone = { setShowExploratoryByMilestone };
   ```

### 4.3 `frontend/src/components/PreprodSection.tsx`

1. **Nouvelles props dans l'interface** :

   ```ts
   showExploratoryByMilestone?: boolean;
   setShowExploratoryByMilestone?: (show: boolean) => void;
   ```

2. **Destructuring et forwarding** vers `<CampaignGrid>` :
   ```tsx
   <CampaignGrid
     sortedRuns={sortedRuns}
     // ... props existantes ...
     showExploratoryByMilestone={showExploratoryByMilestone}
     setShowExploratoryByMilestone={setShowExploratoryByMilestone}
   />
   ```

### 4.4 `frontend/src/components/preprod/CampaignGrid.tsx`

1. **Nouvelles props** :

   ```ts
   showExploratoryByMilestone?: boolean;
   setShowExploratoryByMilestone?: (show: boolean) => void;
   ```

2. **Nouveau toggle** dans la barre de contrôles (entre "Dernier actif" et "Tout afficher") :

   ```tsx
   {
     setShowExploratoryByMilestone && (
       <Toggle
         label={useBusiness ? 'Exploratoires' : 'Exploratory'}
         checked={showExploratoryByMilestone}
         onChange={() => setShowExploratoryByMilestone(!showExploratoryByMilestone)}
       />
     );
   }
   ```

3. **Pagination adaptée** (remplace le calcul de `displayCount` / `visibleRuns`) :

   ```ts
   const normalRuns = showExploratoryByMilestone ? sortedRuns.filter((r) => !r.isExploratory) : sortedRuns;
   const exploratoryRuns = showExploratoryByMilestone ? sortedRuns.filter((r) => r.isExploratory) : [];

   const displayCount = showAllRuns ? normalRuns.length : normalRuns.length <= 12 ? 12 : 8;
   const visibleNormal = normalRuns.slice(0, displayCount);
   const visibleRuns = [...visibleNormal, ...exploratoryRuns];
   ```

4. **Mise à jour du compteur "autres campagnes"** :
   - Le `hasMore` ne compte que les `normalRuns` non affichés.

---

## 5. Tests

### 5.1 `Dashboard4.test.jsx` / `Dashboard4.test.tsx`

| #   | Cas                                                                                                                          | Attendu                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | `showExploratoryByMilestone=false`, 15 runs normaux + 3 exploratoires                                                        | Seuls 8 runs normaux visibles (limite par défaut)       |
| 2   | `showExploratoryByMilestone=true`, `selectedPreprodMilestones=[10]`, 15 normaux + 3 exploratoires dont 2 liés à milestone 10 | 8 normaux + 2 exploratoires visibles                    |
| 3   | `showLatestOnly=true` + toggle exploratoire ON                                                                               | 1 latest non-exploratoire + exploratoires liés visibles |
| 4   | Dédoublonnage — un run avec `isExploratory=true` est aussi dans la base                                                      | Pas de doublon dans la liste affichée                   |

### 5.2 `CampaignGrid.test.tsx` (à créer si absent)

| #   | Cas                                               | Attendu                                                            |
| --- | ------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | Rendu avec `setShowExploratoryByMilestone` défini | Le toggle "Exploratoires" est présent dans le DOM                  |
| 2   | Clic sur le toggle                                | `setShowExploratoryByMilestone` est appelé avec la valeur inversée |
| 3   | `useBusiness=true`                                | Le label affiche "Exploratoires"                                   |
| 4   | `useBusiness=false`                               | Le label affiche "Exploratory"                                     |

### 5.3 `PreprodSection.test.tsx`

- Vérifier que `showExploratoryByMilestone` et `setShowExploratoryByMilestone` sont bien transmis à `CampaignGrid`.

---

## 6. Edge Cases & Decisions

| Situation                                   | Décision                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| `selectedPreprodMilestones` est vide        | Le toggle est fonctionnel mais ne produit aucun effet (pas de milestone pour filtrer)  |
| Un run exploratoire a `milestone` undefined | Il n'est pas inclus (`includes(undefined)` retourne false)                             |
| `showLatestOnly` + toggle ON                | Le latest non-exploratoire est affiché, les exploratoires liés sont ajoutés en dessous |
| `showAllRuns` + toggle ON                   | Tous les runs normaux + tous les exploratoires liés sont visibles                      |
| Toggle OFF                                  | Retour au comportement existant, sans régression                                       |

---

## 7. Non-goals (hors scope)

- Modifier le backend pour produire des runs avec `isExploratory: true`.
- Ajouter un endpoint API dédié aux sessions exploratoires.
- Modifier le style visuel des cartes exploratoires (déjà implémenté dans `CampaignCard`).
- Persister l'état du toggle dans le localStorage ou l'URL.

---

## 8. Séquence d'implémentation

1. Mettre à jour `types/api.types.ts` (`milestone?: number`).
2. Ajouter l'état et la logique `displayedRuns` dans `Dashboard4.tsx`.
3. Propager les props dans `PreprodSection.tsx`.
4. Modifier `CampaignGrid.tsx` (toggle + pagination adaptée).
5. Écrire / mettre à jour les tests.
6. Vérifier manuellement le rendu et l'absence de régression sur le toggle existant.
