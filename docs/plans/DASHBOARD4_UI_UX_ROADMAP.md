# Dashboard 4 — Roadmap UX/UI Redesign

> Approche validée : **Option B (Redesign structuré — "Grid & Interact")** puis **Option C (Dashboard-as-a-Product)**

---

## Phase 1 — Option B : Grid & Interact 🎯 EN COURS

### Objectif

Moderniser Dashboard 4 avec un design system cohérent (grid 12 colonnes, cartes KPI interactives, skeleton loaders, micro-transitions) sans casser la stabilité.

### Todo

- [x] **Design System Tokens** — Utiliser les tokens CSS existants (`tokens.css`) + nouveaux tokens skeleton dans `App.css`
- [x] **Grid Layout** — Grids responsives `.pp-kpi-grid` (4→2→1) et `.prod-kpi-grid` (2→1)
- [x] **KPI Cards v2** — `KPICard` avec hover élévation, bordure de status, icône+texte, progress bar
- [x] **Skeleton Loader Global** — `SkeletonCard` + `SkeletonDashboard` avec animation shimmer
- [x] **PreprodSection** — Re-layout avec grid KPI + Doughnut Chart + campagnes
- [x] **ProductionSection** — Grid 2-col avec `KPICard` + status badges
- [x] **Charts Upgrade** — Doughnut Chart interactif (react-chartjs-2) avec tooltips et légende
- [x] **Dark Mode Premium** — Tokens sémantiques appliqués automatiquement via `.dark-theme`
- [x] **Micro-interactions** — Transitions 200ms sur les cartes, 400ms sur les progress bars
- [x] **Tests & QA** — Build Vite ✅, type-check ✅ (hors test préexistant)
- [x] **Commit & Push** — `0fca4c6` pushed to origin/main

---

## Phase 2 — Option C : Pro Suite 🚦 BLOQUÉ (attend Phase 1)

### Objectif

Fonctionnalités avancées : widgets personnalisables, mode TV, comparaison temporelle, filtres inline, export par carte.

### Todo

- [ ] **Widgets personnalisables** — Drag & drop des KPIs, sauvegarde layout utilisateur
- [ ] **Mode TV optimisé** — Cycle auto des slides, plein écran, contraste max
- [ ] **Comparaison temporelle** — KPI cards avec delta vs période précédente
- [ ] **Filtres contextuels inline** — Remplacer le sélecteur de milestones par des chips interactives
- [ ] **Export par carte** — Bouton PDF/PNG sur chaque MetricCard
- [ ] **Commit & Push** — `git add . && git commit -m "feat(dashboard4): Option C pro suite — widgets, TV mode, inline filters, export"`

---

## Références UX/UI

- Nielsen Norman Group — F-Pattern scanning, visual hierarchy
- Skill `ui-ux-pro-max` — Accessibilité CRITICAL, Touch ≥48dp, Animation 150-300ms
- 5of10.com / UXPin — Dashboard design principles 2025
- Stripe / Datadog / Grafana — Inspiration layouts
