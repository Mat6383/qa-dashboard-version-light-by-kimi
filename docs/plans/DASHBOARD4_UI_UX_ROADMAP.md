# Dashboard 4 — Roadmap UX/UI Redesign

> Approche validée : **Option B (Redesign structuré — "Grid & Interact")** puis **Option C (Dashboard-as-a-Product)**

---

## Phase 1 — Option B : Grid & Interact 🎯 EN COURS

### Objectif

Moderniser Dashboard 4 avec un design system cohérent (grid 12 colonnes, cartes KPI interactives, skeleton loaders, micro-transitions) sans casser la stabilité.

### Todo

- [ ] **Design System Tokens** — Créer les variables CSS sémantiques (colors, spacing, shadows, typography) dans `frontend/src/styles/tokens.css`
- [ ] **Grid Layout** — Implémenter un container grid 12-colonnes responsive dans Dashboard4
- [ ] **KPI Cards v2** — Refonte de MetricCard : ombre subtile, hover tooltip, clic drill-down, sparkline, contexte comparatif
- [ ] **Skeleton Loader Global** — Remplacer le spinner plein écran par des skeleton cards sur les métriques
- [ ] **PreprodSection** — Re-layout en panneaux collapsibles avec transitions 200ms
- [ ] **ProductionSection** — Même traitement + amélioration des couleurs d'état (escape/detection)
- [ ] **Charts Upgrade** — Légendes interactives, tooltips riches, responsive reflow
- [ ] **Dark Mode Premium** — Appliquer les tokens sémantiques, vérifier les contrastes 4.5:1
- [ ] **Micro-interactions** — Transitions 150-300ms sur les données fraîches (pas de blink brutal)
- [ ] **Tests & QA** — Vérifier le build, le dark mode, le responsive, l'accessibilité
- [ ] **Commit & Push** — `git add . && git commit -m "feat(dashboard4): Option B redesign — grid, KPI cards, skeleton, interactions"`

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
