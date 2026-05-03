# Audit UI/UX Frontend — QA Dashboard

> Audit réalisé avec la méthodologie **UI/UX Pro Max** (10 catégories de priorité).  
> Scope : `frontend/src/` (React + TypeScript + CSS).  
> Date : avril 2026.

---

## Résumé exécutif

| Catégorie              | Priorité | Score   | Tendance              |
| ---------------------- | -------- | ------- | --------------------- |
| 1. Accessibilité       | CRITICAL | 🟡 6/10 | ⚠️ Besoin d'attention |
| 2. Touch & Interaction | CRITICAL | 🟡 6/10 | ⚠️ Besoin d'attention |
| 3. Performance         | HIGH     | 🟢 7/10 | ✅ Correct            |
| 4. Style Selection     | HIGH     | 🟡 6/10 | ⚠️ Besoin d'attention |
| 5. Layout & Responsive | HIGH     | 🟡 6/10 | ⚠️ Besoin d'attention |
| 6. Typography & Color  | MEDIUM   | 🟡 5/10 | ⚠️ Besoin d'attention |
| 7. Animation           | MEDIUM   | 🟡 5/10 | ⚠️ Besoin d'attention |
| 8. Forms & Feedback    | MEDIUM   | 🟢 7/10 | ✅ Correct            |
| 9. Navigation Patterns | HIGH     | 🟡 6/10 | ⚠️ Besoin d'attention |
| 10. Charts & Data      | LOW      | 🟡 5/10 | ⚠️ Besoin d'attention |

**Score global estimé : 6.0 / 10** — Dashboard fonctionnel et moderne, mais plusieurs lacunes d'accessibilité, de cohérence visuelle et de polish mobile à corriger pour atteindre un niveau professionnel premium.

---

## 1. Accessibilité (CRITICAL) — 🟡 6/10

### ✅ Ce qui va bien

- **Focus states** présents sur les éléments interactifs (box-shadow bleue sur `.project-selector:focus`).
- **ARIA labels** sur la plupart des boutons et selects (`aria-label={t('layout.selectProject')}`).
- **Landmarks sémantiques** : `role="banner"`, `role="main"`, `role="contentinfo"`.
- **Drawer mobile** : `role="dialog"`, `aria-modal="true"`, `aria-label` explicite.
- **Bottom nav** : `aria-current="page"` sur l'item actif.
- Le badge "En cours" dans Dashboard4 combine **couleur + texte** (pas d'info couleur-seule).

### ⚠️ Problèmes majeurs

| Règle               | Problème                                                                                               | Fichier(s)             |
| ------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------- |
| `skip-links`        | **Aucun skip-link** pour passer le header (23+ éléments tabulables avant le contenu)                   | `AppLayout.tsx`        |
| `heading-hierarchy` | Pas de `h1` dans le main ; le `h1` du header est le titre global de l'app                              | `AppLayout.tsx`        |
| `reduced-motion`    | **Aucune gestion** de `prefers-reduced-motion` ; animations CSS partout                                | `App.css`, composants  |
| `aria-live-errors`  | Le Toast n'a pas `role="alert"` ni `aria-live`                                                         | `Toast.tsx`            |
| `color-contrast`    | Bordure `--border-color: #2563eb` en dark mode sur fond `#0b1120` → ratio ~3.8:1, limite pour du texte | `App.css` (dark-theme) |
| `voiceover-sr`      | Les boutons d'export dans le header n'ont que `title`, pas d'`aria-label`                              | `AppLayout.tsx`        |

### 🔴 Anti-pattern détecté

- L'emoji ⚠️ est utilisé comme icône structurelle dans le banner de mode dégradé (`AppLayout.tsx:140`). Remplacer par `<AlertTriangle>` de Lucide.

---

## 2. Touch & Interaction (CRITICAL) — 🟡 6/10

### ✅ Ce qui va bien

- **Touch targets** >= 44×44px explicites sur le bouton menu mobile (`minWidth: '44px'`).
- **Mobile bottom nav** : `min-height: 44px` + `touch-action: manipulation`.
- **Loading feedback** sur les boutons async (spinner, état `disabled`).
- **Cursor pointer** sur les éléments interactifs.

### ⚠️ Problèmes majeurs

| Règle                 | Problème                                                                                                                      | Fichier(s)                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `hover-vs-tap`        | Dashboard4 utilise `onMouseEnter`/`onMouseLeave` pour changer la couleur des boutons → **pas de feedback tactile** sur mobile | `Dashboard4.tsx` (l. 187-210)   |
| `press-feedback`      | Les `.btn-icon` n'ont pas d'état `:active` visuel distinct du `:hover`                                                        | `App.css`                       |
| `tap-delay`           | `touch-action: manipulation` manquant globalement sur les boutons desktop                                                     | `App.css`                       |
| `gesture-alternative` | Le drawer mobile ne se ferme **pas avec Escape**                                                                              | `MobileDrawer.tsx`              |
| `error-feedback`      | L'état d'erreur backend n'est pas vocalisé aux screen readers                                                                 | `AppLayout.tsx` (BackendStatus) |

---

## 3. Performance (HIGH) — 🟢 7/10

### ✅ Ce qui va bien

- **Virtualisation** de liste avec `@tanstack/react-virtual` sur Dashboard7.
- **React Query** pour le cache et la réduction de requêtes.
- **Lazy loading** des dashboards via `React.lazy` dans `AppRouter`.
- **Debouncing** sur la recherche d'itérations (400ms).

### ⚠️ Problèmes à corriger

| Règle                  | Problème                                                               | Fichier(s)                         |
| ---------------------- | ---------------------------------------------------------------------- | ---------------------------------- |
| `font-loading`         | Le Google Fonts link n'a pas `&display=swap` → risque de FOIT          | `index.html` (l. 19)               |
| `progressive-loading`  | **Aucun skeleton screen** ; seulement des spinners centrés             | `Dashboard4.tsx`, `Dashboard7.tsx` |
| `image-dimension`      | Pas de `width`/`height` sur les icônes/images (mais peu impactant ici) | global                             |
| `lazy-load-below-fold` | Les charts pourraient être lazy-loadés avec `react-chartjs-2`          | dashboards                         |

---

## 4. Style Selection (HIGH) — 🟡 6/10

### ✅ Ce qui va bien

- **Icônes vectorielles** : Lucide-React partout (SVG).
- **Style cohérent** : flat design moderne, cards avec ombres subtiles.
- **Dark mode** et **TV mode** implémentés.

### ⚠️ Problèmes majeurs

| Règle                        | Problème                                                                                                      | Fichier(s)                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `no-emoji-icons`             | Emoji ⚠️ dans le banner mode dégradé                                                                          | `AppLayout.tsx:140`                            |
| `color-palette-from-product` | Couleurs **hardcodées** en raw hex dans les composants au lieu des tokens CSS                                 | `Dashboard4.tsx`, `Toast.tsx`, `AppLayout.tsx` |
| `consistency`                | Mélange de styles inline, CSS global, et CSS par composant → difficile à maintenir                            | global                                         |
| `elevation-consistent`       | Ombres arbitraires : `0 4px 20px rgba(0,0,0,0.05)` dans Dashboard4, `var(--shadow-md)` ailleurs               | `Dashboard4.tsx`                               |
| `dark-mode-pairing`          | Le dark mode est défini mais **pas testé sur tous les dashboards** (certains styles inline ignorent le thème) | `Dashboard4.tsx` (hardcoded colors)            |

---

## 5. Layout & Responsive (HIGH) — 🟡 6/10

### ✅ Ce qui va bien

- **Viewport meta** correct : `width=device-width, initial-scale=1.0, viewport-fit=cover`.
- **Safe areas** respectées : `env(safe-area-inset-bottom)` sur mobile bottom nav et footer.
- **Breakpoints** systématiques (480px / 768px / 1024px / 1920px).
- **Mobile drawer** bien dimensionné (`min(85vw, 360px)`).

### ⚠️ Problèmes majeurs

| Règle               | Problème                                                                                                                                                   | Fichier(s)                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `mobile-first`      | Le CSS est écrit desktop-first puis surchargé en mobile (anti-pattern)                                                                                     | `App.css`                                          |
| `container-width`   | `max-width: 1600px` sur `.app-main` mais certains dashboards ignorent cette contrainte                                                                     | `Dashboard4.tsx` (`width: 100%`, pas de max-width) |
| `horizontal-scroll` | `grid-template-columns: repeat(auto-fit, minmax(500px, 1fr))` sur `.charts-section` → risque de horizontal scroll sur mobile si viewport < 500px + padding | `App.css:384`                                      |
| `scroll-behavior`   | Le header sticky cache potentiellement du contenu scrollable (pas de padding-top compensatoire sur `.app-main`)                                            | `App.css`                                          |
| `touch-density`     | Le header desktop est **surchargé** (>15 éléments interactifs) → confusion visuelle                                                                        | `AppLayout.tsx`                                    |

---

## 6. Typography & Color (MEDIUM) — 🟡 5/10

### ✅ Ce qui va bien

- **Police Inter** avec fallback système complet.
- **Font-smoothing** activé (`-webkit-font-smoothing: antialiased`).

### ⚠️ Problèmes majeurs

| Règle                | Problème                                                                                                    | Fichier(s)                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `line-height`        | Pas de `line-height` global défini → défault navigateur ~1.2, trop serré pour la lisibilité                 | `App.css` (body)                    |
| `font-scale`         | Pas d'échelle typographique formelle ; font-size arbitraires : `1.35rem`, `0.875rem`, `0.75rem`, `0.625rem` | global                              |
| `color-semantic`     | Tokens CSS existent mais **pas utilisés partout** ; raw hex dominent dans les composants                    | `Dashboard4.tsx`, `Toast.tsx`       |
| `text-styles-system` | Pas de mapping vers un système de type (Display, Headline, Body, Label)                                     | global                              |
| `weight-hierarchy`   | Inconsistant : `font-weight: 700` utilisé pour des labels de 0.95rem                                        | `Dashboard4.tsx` (badge "En cours") |
| `number-tabular`     | Pas de `font-variant-numeric: tabular-nums` sur les colonnes de données                                     | dashboards                          |

---

## 7. Animation (MEDIUM) — 🟡 5/10

### ✅ Ce qui va bien

- **Durées raisonnables** : 0.2s–0.3s pour les micro-interactions, 0.4s pour le drawer.
- **Transform/opacity** utilisés pour les animations principales (drawer, fade).

### ⚠️ Problèmes majeurs

| Règle                   | Problème                                                                                | Fichier(s)        |
| ----------------------- | --------------------------------------------------------------------------------------- | ----------------- |
| `reduced-motion`        | **Aucune** media query `prefers-reduced-motion` dans tout le projet                     | `App.css`, global |
| `easing`                | Pas de tokens d'easing ; tout est `ease`, `ease-in-out` ou `linear`                     | global            |
| `motion-meaning`        | Le spinner de loading est purement décoratif (1s linear infinite) ; pas de sens spatial | `App.css`         |
| `no-blocking-animation` | Le refresh manual désactive le bouton mais pas d'état visuel de blocage global          | `AppLayout.tsx`   |

---

## 8. Forms & Feedback (MEDIUM) — 🟢 7/10

### ✅ Ce qui va bien

- **Labels visibles** sur tous les inputs de Dashboard6.
- **Error placement** proche des champs (Dashboard6).
- **Empty states** riches et contextualisés (Dashboard7 : "Sélectionnez une itération", "Aucun ticket trouvé").
- **Confirmation dialogs** avant actions destructrices (modals de clôture).
- **Progress indicator** pendant la sync SSE (barre + log).

### ⚠️ Problèmes à corriger

| Règle               | Problème                                                                             | Fichier(s)             |
| ------------------- | ------------------------------------------------------------------------------------ | ---------------------- |
| `toast-dismiss`     | Toast duration = 5000ms (limite haute) ; pas de pause au hover                       | `Toast.tsx`            |
| `inline-validation` | Pas de validation inline sur les formulaires des modals                              | `TestClosureModal.tsx` |
| `error-clarity`     | Messages d'erreur génériques (`"Erreur de chargement"`) sans recovery path explicite | `Dashboard7.tsx`       |
| `focus-management`  | Après fermeture d'un modal, le focus n'est pas restauré sur le bouton déclencheur    | modals                 |

---

## 9. Navigation Patterns (HIGH) — 🟡 6/10

### ✅ Ce qui va bien

- **Deep linking** : React Router sur toutes les pages.
- **Bottom nav ≤5 items** : 5 items de base, 6 pour admin (limite supérieure).
- **Nav state active** : `aria-current="page"` + classe `.active`.
- **State preservation** : React Query conserve les données en cache au retour arrière.

### ⚠️ Problèmes majeurs

| Règle                   | Problème                                                                                                               | Fichier(s)         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `nav-label-icon`        | Bottom nav OK, mais le header desktop utilise un `<select>` pour changer de dashboard → **perte de contexte spatiale** | `AppLayout.tsx`    |
| `breadcrumb-web`        | **Aucun breadcrumb** sur les pages admin profondes (`/admin/audit`, `/admin/retention`)                                | global             |
| `back-behavior`         | Le bouton "Retour" du navigateur fonctionne, mais il n'y a pas de bouton back explicite dans les flows modals          | modals             |
| `drawer-usage`          | Le drawer mobile est utilisé pour les paramètres (OK), mais contient aussi des actions primaires (exports)             | `MobileDrawer.tsx` |
| `focus-on-route-change` | Pas de gestion du focus au changement de route (screen readers perdent le contexte)                                    | `AppRouter.tsx`    |

---

## 10. Charts & Data (LOW) — 🟡 5/10

### ✅ Ce qui va bien

- Chart.js avec `react-chartjs-2` bien intégré.
- Tooltips natifs de Chart.js.

### ⚠️ Problèmes à corriger

| Règle                   | Problème                                                                                            | Fichier(s)        |
| ----------------------- | --------------------------------------------------------------------------------------------------- | ----------------- |
| `data-table`            | **Pas d'alternative tabulaire** pour les screen readers sur les charts                              | dashboards        |
| `color-guidance`        | Pas de vérification que les palettes sont safe pour daltoniens (rouge/vert utilisés pour pass/fail) | `StatusChart.tsx` |
| `responsive-chart`      | Les charts Chart.js sont responsive, mais pas de simplification sur très petits écrans              | global            |
| `screen-reader-summary` | Aucun `aria-label` ou texte alternatif résumant les données du chart                                | dashboards        |

---

## Plan d'action priorisé

### 🔴 P0 — Critique (bloquant accessibilité)

1. **Remplacer l'emoji ⚠️** par `<AlertTriangle>` dans le banner circuit breaker.
2. **Ajouter `prefers-reduced-motion`** : désactiver animations si demandé.
3. **Ajouter des skip-links** (`Skip to main content`).
4. **Corriger le focus trap et le retour de focus** sur les modals.
5. **Ajouter `role="alert"` + `aria-live="polite"`** sur le Toast.

### 🟠 P1 — Important (maintenabilité & qualité)

6. **Centraliser les couleurs** : éliminer les raw hex des composants, utiliser `var(--color-*)` partout.
7. **Créer une échelle typographique** formelle (design tokens).
8. **Ajouter `display=swap`** au Google Fonts link.
9. **Refactoriser Dashboard4** : extraire les styles inline en classes CSS thémées.
10. **Ajouter `font-variant-numeric: tabular-nums`** sur les colonnes de données.

### 🟡 P2 — Amélioration (polish UX)

11. **Ajouter des skeleton screens** en remplacement des spinners de chargement.
12. **Implémenter un breadcrumb** pour les pages admin profondes.
13. **Ajouter des `aria-describedby`** liant les messages d'erreur aux champs de formulaire.
14. **Uniformiser les tokens d'ombre/border-radius** dans tous les composants.
15. **Ajouter un bouton "Back to top"** sur les longues listes (Dashboard7).

---

## Fichiers à refaire passer en revue

- `frontend/src/components/AppLayout.tsx` — surcharge du header, manque skip-links
- `frontend/src/components/Dashboard4.tsx` — styles inline excessifs, hardcoded colors
- `frontend/src/components/Toast.tsx` — manque aria-live
- `frontend/src/components/MobileDrawer.tsx` — manque fermeture Escape
- `frontend/src/styles/App.css` — manque prefers-reduced-motion, line-height global
- `frontend/index.html` — manque display=swap sur le font link
