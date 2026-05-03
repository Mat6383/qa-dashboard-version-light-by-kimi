# 📊 Rapport d'Analyse — QA Dashboard (Testmo Dashboard)

**Date d'analyse :** 2026-04-22  
**Modèle utilisé :** kimi k2.6  
**Mode :** Lecture seule — aucune ligne de code modifiée  
**Auteur :** Kimi Code CLI  

---

## 1. Vue d'ensemble du projet

Le **QA Dashboard** (aussi nommé *Testmo Dashboard*) est une application fullstack de monitoring et de reporting QA, construite autour de l'outil **Testmo** et intégrée avec **GitLab**. Elle couvre les standards ISTQB, ITIL et LEAN, avec des fonctionnalités avancées de synchronisation bidirectionnelle, de génération de rapports (HTML/PPTX/DOCX/PDF) et de tableaux de bord multi-vues.

### Structure du projet

```
qa-dashboard/
├── backend/          # API Express + services métier + tests Jest
├── frontend/         # React 18 + Vite + Chart.js
├── docs/             # Routines Claude, plans de migration
├── reports/          # Exemples de livrables (R06)
├── README.md, CLAUDE.md, QUICK_START.md
└── package.json (racine minimaliste)
```

---

## 2. Stack technique détaillée

### Backend (`backend/`)

| Couche | Technologie | Version | Remarque |
|--------|-------------|---------|----------|
| Runtime | Node.js | ≥18 (implicite) | |
| Framework | Express | 4.18.2 | |
| HTTP Client | Axios | 1.6.5 | Testmo + GitLab |
| Cache | Map JS en mémoire | — | Durée configurable (defaut 30s) |
| Persistance légère | better-sqlite3 | 12.8.0 | Historique sync + commentaires CrossTest |
| Persistance config | JSON fichier | — | `data/auto-sync-config.json` |
| Validation | Zod | 3.24.0 | Excellente couverture params/body |
| Sécurité | Helmet + CORS + Rate-limit | — | Multi-origines, 200 req/min |
| Cron | node-cron | 4.2.1 | Auto-sync lun-ven 8h-18h |
| Logging | Winston | 3.11.0 | Niveaux info/warn/error |
| Compression | compression (gzip) | 1.7.4 | |
| Reports | pptxgenjs + marked | 4.x | Génération PPTX/HTML |
| Tests | Jest | 29.7.0 | 6 suites, ~2700 lignes de tests |

### Frontend (`frontend/`)

| Couche | Technologie | Version | Remarque |
|--------|-------------|---------|----------|
| Framework | React | 18.2.0 | JSX vanilla (pas de TS) |
| Build tool | Vite | 5.0.8 | Terser, drop_console en prod |
| Routing | ❌ Aucun | — | Bascule manuelle par state `dashboardView` |
| State Management | ❌ Aucun | — | Hooks natifs + localStorage |
| HTTP Client | Axios | 1.6.5 | Service unique `api.service.js` |
| Charts | Chart.js + react-chartjs-2 | 4.4.1 / 5.2.0 | Doughnut, Bar, Line |
| Charts (inutilisé) | Recharts | 2.10.3 | **Présent mais non utilisé** |
| Icons | lucide-react | 0.263.1 | |
| Export PDF | html2canvas + jspdf | 1.4.1 / 4.2.0 | Capture DOM → PDF |
| Export DOCX | docx | 9.6.1 | Rapport ISTQB complet |
| Styling | CSS vanilla | — | Variables CSS light/dark, styles inline |
| Tests | ❌ Aucun | — | Zero test frontend |

---

## 3. Points forts ✅

### Architecture backend
- **Code bien structuré** : séparation routes/services/validators/config claire.
- **Validation Zod** exhaustive sur tous les endpoints critiques (sync, reports, crosstest, auto-config).
- **Rate-limiting différencié** : 200 req/min global, 20 req/min sur les endpoints lourds (`/reports/generate`, `/sync/execute`).
- **Retry logic avec backoff exponentiel** dans `testmo.service.js` (testée dans `resilience.test.js`).
- **Cache LEAN en mémoire** avec TTL configurable sur les appels Testmo fréquents.
- **SSE (Server-Sent Events)** bien implémentés pour les syncs temps réel (Dashboard 6 & 8).
- **Auto-sync cron** configurable à chaud via API sans redémarrage.
- **Logging structuré** Winston avec contexte métier (ITIL Event Management).
- **Gestion gracieuse des signaux** SIGTERM/SIGINT.

### Qualité des tests backend
- **6 suites de tests, ~2700 lignes**, très bien écrites :
  - `calculations.test.js` — logique métier ISTQB pure (991 lignes)
  - `gitlab.graphql.test.js` — couche GraphQL + REST (439 lignes)
  - `resilience.test.js` — retry, CORS, rate-limit, timezone (435 lignes)
  - `version-only-mode.test.js` — nouveau mode version-seule (357 lignes)
  - `integrity.guards.test.js` — guards défensifs (216 lignes)
  - `report.calculations.test.js` — logique rapports (230 lignes)
- Fonctions pures extraites et testées isolément.
- Edge cases documentés (division par zéro, liens markdown, cas réels "Gab/Pauline/Sophie").

### Fonctionnalités métier riches
- **9 vues/dashboards** avec des responsabilités distinctes (ISTQB, ITIL, LEAN, TV mode, Sync, CrossTest, etc.).
- **Synchronisation bidirectionnelle** GitLab ↔ Testmo avec preview dry-run.
- **Génération de rapports multi-formats** : HTML, PPTX, DOCX, PDF.
- **Support des sessions exploratoires** Testmo avec règles de progression spécifiques ("Règle Sophie").
- **Commentaires persistés** sur les issues CrossTest (CRUD complet en SQLite).

### Documentation
- `README.md` très complet (395 lignes) : installation, métriques ISTQB avec formules, endpoints, FAQ, sécurité, déploiement.
- `CLAUDE.md` excellent pour un agent : architecture, mapping status IDs, variables d'environnement, auto-sync.
- `docs/routines/` : prompts Claude Desktop prêts à l'emploi.
- `docs/superpowers/plans/` : plan de migration massif en 7 phases (912 lignes) très structuré.

---

## 4. Axes d'amélioration 🔧

### 4.1 Architecture & Code Quality

| # | Problème | Sévérité | Localisation |
|---|----------|----------|--------------|
| 4.1.1 | **`server.js` monolithique (1131 lignes)** — routes déclarées en inline, pas de séparation router/controller. Le fichier fait office de routeur + contrôleur + orchestrateur cron. | 🔴 Haute | `backend/server.js` |
| 4.1.2 | **Routes dupliquées** — Certaines routes existent à la fois dans `server.js` (inline) et dans `backend/routes/*.js` (router Express), mais `server.js` ne les utilise pas. Ex: `/api/dashboard/*` existe dans `server.js` ET `dashboard.routes.js` sans `app.use()`. | 🟠 Moyenne | `backend/server.js` + `routes/` |
| 4.1.3 | **Pas de séparation Controller/Service** — Les handlers Express mélangent logique HTTP (status, headers SSE) et appels métier. | 🟡 Faible | Global backend |
| 4.1.4 | **`App.jsx` monolithique (532 lignes)** — Routing manuel, state global, data fetching, health check, auto-refresh, header/footer, tout dans un seul composant. | 🔴 Haute | `frontend/src/App.jsx` |
| 4.1.5 | **Drilling de props excessif** — `isDark`, `useBusiness`, `metrics` passés manuellement à travers 3-4 niveaux. Pas de Context React. | 🟠 Moyenne | Frontend global |
| 4.1.6 | **Nomenclature des dashboards non sémantique** — `Dashboard3`, `Dashboard4`... Au lieu de `QualityRatesDashboard`, `GlobalViewDashboard`, etc. | 🟡 Faible | `frontend/src/components/` |
| 4.1.7 | **CSS éparpillé** — Inline styles, fichiers CSS globaux, classes BEM-like (`d6-`, `d7-`, `d8-`) coexistent sans convention unique. | 🟡 Faible | Frontend global |
| 4.1.8 | **Doublon de logique métier** — Calcul des couleurs selon seuils recopié dans `MetricsCards.jsx`, `RunsList.jsx`, `Dashboard4.jsx`, `TvDashboard.jsx`. | 🟡 Faible | Frontend |

**Recommandations :**
- Refactorer `server.js` pour utiliser les routers dans `backend/routes/` avec `app.use('/api/dashboard', dashboardRoutes)`.
- Introduire une couche Controller entre Routes et Services.
- Extraire le state global d'`App.jsx` dans des Contexts React (thème, métriques, préférences).
- Renommer les composants Dashboard avec des noms sémantiques.
- Créer des hooks personnalisés (`useMetrics`, `useTheme`, `useDashboardView`).

---

### 4.2 Performance

| # | Problème | Sévérité | Localisation |
|---|----------|----------|--------------|
| 4.2.1 | **Pas de lazy loading** — Tous les dashboards sont importés statiquement dans `App.jsx` même ceux rarement utilisés. | 🟠 Moyenne | `frontend/src/App.jsx` |
| 4.2.2 | **Bundle potentiellement lourd** — `html2canvas` + `jspdf` + `docx` + `recharts` (inutilisé) chargés dès le démarrage. Pas de `manualChunks` dans Vite. | 🟠 Moyenne | `frontend/vite.config.js` |
| 4.2.3 | **Recharts installé mais inutilisé** — Ajoute du poids au bundle pour rien (~70-100ko gzip estimé). | 🟡 Faible | `frontend/package.json` |
| 4.2.4 | **Cache backend non distribué** — Map JS en mémoire, invalide en cas de redémarrage ou scaling horizontal. | 🟡 Faible | `backend/services/testmo.service.js` |
| 4.2.5 | **Requêtes potentiellement N+1** dans `getEscapeAndDetectionRates` — boucle sur les runs avec `getRunDetails` + `/results` par run en production. | 🟠 Moyenne | `backend/services/testmo.service.js` |

**Recommandations :**
- Implémenter `React.lazy()` + `Suspense` pour chaque dashboard.
- Configurer `manualChunks` dans Vite pour splitter les librairies lourdes (pdf, docx, charts).
- Supprimer `recharts` des dépendances.
- Envisager Redis ou un cache partagé si le backend scale horizontalement.
- Optimiser `getEscapeAndDetectionRates` avec du batching ou du caching par run.

---

### 4.3 Tests & Qualité

| # | Problème | Sévérité | Localisation |
|---|----------|----------|--------------|
| 4.3.1 | **Aucun test frontend** — Zero test sur React/Vite. Pas de Vitest, Jest frontend, ni React Testing Library. | 🔴 Haute | `frontend/` |
| 4.3.2 | **Aucun test d'intégration API** — Pas de `supertest` sur les routes Express. | 🟠 Moyenne | `backend/` |
| 4.3.3 | **Tests legacy coexistants** — `STATUS_TO_LABEL` tests encore présents alors que le plan de migration Phase 7 prévoit leur suppression. | 🟡 Faible | `backend/tests/calculations.test.js` |
| 4.3.4 | **Pas de linting / formatting** — Pas d'ESLint, Prettier, ni Husky. | 🟡 Faible | Global |
| 4.3.5 | **Pas de CI/CD** — Pas de `.github/workflows/`. | 🟡 Faible | Racine |

**Recommandations :**
- Ajouter **Vitest** + **React Testing Library** dans le frontend.
- Ajouter **supertest** pour tester les routes Express (happy path + erreurs).
- Finaliser la Phase 7 du plan de migration (cleanup tests legacy).
- Ajouter ESLint + Prettier avec des configs standard (Airbnb ou StandardJS).
- Mettre en place une CI GitHub Actions (lint + tests backend + build frontend).

---

### 4.4 Sécurité & Robustesse

| # | Problème | Sévérité | Localisation |
|---|----------|----------|--------------|
| 4.4.1 | **`alert()` natif utilisé** dans `App.jsx` pour le nettoyage de cache. Un composant Toast existe mais n'est pas utilisé. | 🟡 Faible | `frontend/src/App.jsx` |
| 4.4.2 | **`window.confirm` natif** dans `Dashboard7.jsx` pour suppression de commentaires. | 🟡 Faible | `frontend/src/components/Dashboard7.jsx` |
| 4.4.3 | **Données localStorage sans validation** — Si un ID de projet/milestone est supprimé côté backend, le frontend tente quand même de le charger. | 🟡 Faible | `frontend/src/App.jsx` |
| 4.4.4 | **CORS** autorise les requêtes sans origin (`!origin`) — acceptable pour curl/Postman mais à documenter clairement. | 🟢 Info | `backend/server.js` |
| 4.4.5 | **Pas d'authentification** — L'API est ouverte, seulement protégée par le rate-limiting. | 🟠 Moyenne | Global backend |

**Recommandations :**
- Remplacer les `alert()`/`confirm()` natifs par le système de toasts existant + une modal de confirmation.
- Valider les IDs depuis localStorage au chargement (appel `/api/projects` pour vérifier l'existence).
- Documenter la politique CORS dans le README.
- Si l'application est exposée à Internet, envisager une authentification minimale (API key, JWT, ou OAuth GitLab).

---

### 4.5 UX & Accessibilité (a11y)

| # | Problème | Sévérité | Localisation |
|---|----------|----------|--------------|
| 4.5.1 | **Pas de routing** — Impossible de partager une URL vers un dashboard spécifique. Le retour arrière du navigateur ne fonctionne pas. | 🟠 Moyenne | Frontend global |
| 4.5.2 | **Modals sans gestion de focus** — Pas de trap focus, pas de restauration du focus, pas de fermeture Escape (sauf textarea Dashboard7). | 🟠 Moyenne | `frontend/src/components/*Modal*.jsx` |
| 4.5.3 | **Aucun attribut ARIA** — Pas de `role`, `aria-label`, `aria-live` pour les alertes. | 🟡 Faible | Frontend global |
| 4.5.4 | **Sélecteurs `<select multiple>`** pour les jalons — peu ergonomiques sur mobile et peu accessibles. | 🟡 Faible | `frontend/src/components/ConfigurationScreen.jsx` |
| 4.5.5 | **Contraste en dark mode** — Bordures `#1E3A8A` sur fond `#0B1120` potentiellement insuffisantes. | 🟡 Faible | `frontend/src/styles/App.css` |
| 4.5.6 | **localStorage sans sync cross-onglets** — Pas d'écoute d'événement `storage`. | 🟢 Info | `frontend/src/App.jsx` |

**Recommandations :**
- Intégrer **React Router** (ou **TanStack Router**) pour le routing et le deep-linking.
- Ajouter la gestion du focus dans les modals (hook `useFocusTrap` ou librairie `react-focus-lock`).
- Ajouter des attributs ARIA sur les éléments interactifs et les régions live pour les alertes.
- Remplacer les `<select multiple>` par des checkboxes groupées ou un composant de sélection multi plus ergonomique.
- Vérifier les contrastes avec un outil comme Lighthouse ou axe DevTools.

---

### 4.6 Documentation & DevEx

| # | Problème | Sévérité | Localisation |
|---|----------|----------|--------------|
| 4.6.1 | **Incohérence auto-refresh** — README dit 30s, QUICK_START dit 5min. | 🟠 Moyenne | `README.md` vs `QUICK_START.md` |
| 4.6.2 | **`Procédures diverses.md` tronqué** — S'arrête brusquement à `GITLAB_LABEL`. | 🟠 Moyenne | `Procédures diverses.md` |
| 4.6.3 | **`metrics.json` en UTF-16 LE** — Format inhabituel, risque de parsing échoué. | 🟡 Faible | `metrics.json` |
| 4.6.4 | **Redondance README / QUICK_START** — QUICK_START pourrait être réduit à un lien. | 🟢 Info | Racine |
| 4.6.5 | **`repo.json` inutile** — 5 lignes, peu d'utilité. | 🟢 Info | `repo.json` |
| 4.6.6 | **Pas de `package.json` racine opérationnel** — Seulement `{"dependencies":{"pptxgenjs":"^4.0.1"}}`, pas de workspaces ni scripts. | 🟡 Faible | `package.json` (racine) |

**Recommandations :**
- Corriger l'incohérence auto-refresh (vérifier le code source pour la valeur réelle).
- Compléter ou supprimer `Procédures diverses.md`.
- Convertir `metrics.json` en UTF-8.
- Créer un `package.json` racine avec des scripts `dev`, `build`, `test` orchestrant backend + frontend (ou utiliser npm workspaces / pnpm workspaces).

---

## 5. Matrice de priorité des améliorations

### 🔴 Critique (impact élevé, effort variable)
1. **Refactorer `server.js` monolithique** — Utiliser les routers existants dans `backend/routes/`, séparer controllers.
2. **Ajouter des tests frontend** — Vitest + React Testing Library.
3. **Refactorer `App.jsx` monolithique** — Extraire state global dans Contexts + custom hooks.

### 🟠 Important (impact moyen-élevé)
4. **Ajouter le routing frontend** — React Router pour deep-linking et navigation native.
5. **Lazy loading des dashboards** — `React.lazy()` + code splitting Vite.
6. **Ajouter tests d'intégration API** — supertest sur les routes Express.
7. **Optimiser `getEscapeAndDetectionRates`** — Réduire les appels N+1 à Testmo.

### 🟡 Recommandé (impact moyen, effort faible)
8. **Supprimer `recharts`** et nettoyer les dépendances inutilisées.
9. **Remplacer `alert()`/`confirm()` natifs** par le système de toasts/modals existant.
10. **Corriger la documentation** — Incohérences, fichier tronqué, encodage.
11. **Ajouter ESLint + Prettier** + CI GitHub Actions basique.
12. **Renommer les Dashboards** avec des noms sémantiques.

### 🟢 Nice-to-have (impact faible, effort faible)
13. **Créer un `package.json` racine** avec scripts orchestrateurs.
14. **Améliorer l'accessibilité** — ARIA, contrastes, focus trap.
15. **Synchronisation localStorage cross-onglets** via événement `storage`.

---

## 6. Questions pour toi

Avant de décider des améliorations à implémenter, voici quelques questions pour prioriser :

1. **Quel est ton objectif principal ?**  
   - Mise en production / exposition externe → priorité sécurité + auth  
   - Performance / réactivité UI → priorité lazy loading + state management  
   - Maintenabilité à long terme → priorité refactor architecture + tests  
   - Onboarding de nouveaux développeurs → priorité documentation + linting

2. **Le projet va-t-il scaler horizontalement (plusieurs instances backend) ?**  
   Si oui, le cache en mémoire doit être remplacé par Redis ou similaire.

3. **As-tu une préférence sur le state management frontend ?**  
   Context natif suffisant, ou veux-tu introduire Zustand/Redux Toolkit ?

4. **Le frontend doit-il rester en JSX vanilla ou envisages-tu TypeScript ?**  
   Migration TS serait un chantier séparé mais très bénéfique.

5. **Y a-t-il des dashboards peu utilisés qu'on pourrait charger à la demande ?**  
   Ex: Dashboard 6 (Sync), 7 (CrossTest), 8 (Auto-sync) sont des outils administratifs, pas des vues de monitoring quotidien.

---

## 7. Fichiers clés à retenir

### Backend
- `backend/server.js` — Point d'entrée, routes inline (à refactorer)
- `backend/services/testmo.service.js` — Cœur métier ISTQB + cache
- `backend/services/gitlab.service.js` — Intégration GitLab GraphQL/REST
- `backend/services/sync.service.js` — Sync GitLab → Testmo
- `backend/services/status-sync.service.js` — Sync Testmo → GitLab
- `backend/validators/index.js` — Validation Zod
- `backend/tests/` — 6 suites de tests Jest

### Frontend
- `frontend/src/App.jsx` — Orchestrateur principal (à refactorer)
- `frontend/src/services/api.service.js` — Client HTTP unique
- `frontend/src/components/Dashboard4.jsx` — Vue globale + export PDF
- `frontend/src/components/Dashboard6.jsx` — Sync GitLab → Testmo
- `frontend/src/components/Dashboard7.jsx` — CrossTest OK
- `frontend/src/components/Dashboard8.jsx` — Auto-sync control panel
- `frontend/src/utils/docxGenerator.js` — Générateur DOCX ISTQB

---

---

## 8. Analyse globale transversale 🔬

Cette section croise les volets architecture, performance, sécurité, tests, UX et documentation pour identifier les **interdépendances**, les **goulots d'étranglement structurels** et les **effets boule de neige** qui ne sont pas visibles quand on regarde chaque axe séparément.

---

### 8.1 Diagnostic de maturité par axe

| Axe | Niveau | Justification |
|-----|--------|---------------|
| **Architecture backend** | 🟡 Mature avec dette | Services bien découpés, mais `server.js` monolithique et routes dupliquées créent une incohérence structurelle. Les routers Express dans `backend/routes/` sont prêts mais **non branchés**. |
| **Architecture frontend** | 🔴 Immature | `App.jsx` fait tout (state global, routing manuel, data fetching, rendu). Pas de Context, pas de hooks personnalisés, pas de lazy loading. Les 9 dashboards sont importés statiquement. |
| **Qualité du code backend** | 🟢 Mature | Validation Zod, retry logic, cache, logging Winston, rate-limiting. Code documenté et cohérent. |
| **Qualité du code frontend** | 🟡 Moyenne | Composants fonctionnels bien écrits individuellement, mais styles inline massifs, CSS éparpillé, doublons de logique, nomenclature cryptique. |
| **Couverture de tests** | 🟡 Dissymétrique | Backend très bien couvert (6 suites, ~2700 lignes). Frontend : **zéro**. Intégration API : **zéro**. |
| **Performance** | 🟡 Acceptable en l'état | Cache backend efficace, auto-refresh throttlé. Mais bundle frontend non optimisé, pas de code splitting, librairies inutilisées chargées. |
| **Sécurité** | 🟡 Basique | Helmet, CORS, rate-limit. Mais pas d'authentification, pas de validation des IDs localStorage, alert() natifs. |
| **UX / Accessibilité** | 🔴 Faible | Pas de routing, pas de deep-linking, modals sans focus trap, pas d'ARIA, select multiple non ergonomiques. |
| **Documentation** | 🟢 Excellente | README, CLAUDE.md, routines Claude, plans de migration. Quelques incohérences et fichier tronqué. |
| **DevEx / Tooling** | 🔴 Minimal | Pas d'ESLint, Prettier, Husky, ni CI/CD. `package.json` racine inutile. |

**Constat transversal :** Le projet a une **base backend solide et professionnelle**, mais le frontend et le tooling pâtissent d'un développement rapide orienté fonctionnalités sans phase de consolidation. C'est typique d'un projet qui a démarré comme POC puis a gagné en complexité sans refactoring intermédiaire.

---

### 8.2 Goulots d'étranglement structurels

Un goulot d'étranglement structurel est un problème qui bloque ou complexifie **toutes les autres améliorations**. En voici les 3 principaux identifiés :

#### Goulot #1 : `App.jsx` monolithique (frontend)

**Impact transversal :**
- **Bloque l'ajout de routing** — Toute la navigation est codée en dur dans le rendu conditionnel (`dashboardView === '2' ? <TvDashboard /> : ...`). Migrer vers React Router nécessite de déplacer cette logique.
- **Bloque le state management propre** — `metrics`, `isDark`, `useBusinessTerms` sont définis dans `App.jsx` et drillés manuellement. Impossible d'extraire un dashboard sans casser la chaîne de props.
- **Bloque les tests frontend** — Tester `App.jsx` revient à monter quasi toute l'application. Pas d'isolation possible.
- **Bloque le lazy loading** — Les imports sont statiques en haut de fichier. React.lazy nécessite de découpler le rendu conditionnel.
- **Bloque l'amélioration UX** — Pas de deep-linking possible, pas de gestion d'historique navigateur.

**Verdict :** C'est le **point de départ obligatoire** de tout refactoring frontend majeur.

#### Goulot #2 : `server.js` monolithique (backend)

**Impact transversal :**
- **Bloque les tests d'intégration** — Les routes sont inline, pas de router Express modulaire à tester avec `supertest` de manière isolée.
- **Complexifie la maintenance** — 1131 lignes dans un seul fichier. Ajouter un endpoint signifie augmenter la dette.
- **Masque la duplication** — Les routers dans `backend/routes/` existent mais ne sont pas utilisés, créant un double source de vérité. Un développeur peut modifier `dashboard.routes.js` sans effet car `server.js` a sa propre copie inline.
- **Bloque le scaling horizontal** — Le cron auto-sync et l'initialisation SQLite sont dans le même fichier que les routes. En mode cluster, le cron tournerait sur chaque worker.

**Verdict :** Moins critique que `App.jsx` car le backend fonctionne bien, mais nécessaire pour la maintenabilité et les tests d'intégration.

#### Goulot #3 : Absence totale de tests frontend

**Impact transversal :**
- **Bloque tout refactoring frontend** — Sans tests, renommer un composant, extraire un hook, ou migrer vers du routing devient risqué (régression silencieuse).
- **Bloque les montées de version** — Mettre à jour React, Vite, ou Chart.js sans tests est dangereux.
- **Bloque l'onboarding** — Un nouveau développeur ne peut pas modifier le frontend en confiance.
- **Crée un déséquilibre** — Le backend a 2700 lignes de tests, le frontend zéro. La qualité perçue du projet est tirée vers le bas.

**Verdict :** Doit être traité **en parallèle** ou **juste avant** tout refactoring frontend majeur.

---

### 8.3 Analyse des interactions et effets boule de neige

#### Interaction A : Pas de routing ↔ Pas de tests frontend
Sans routing, les composants Dashboard reçoivent leurs données via props drillees depuis `App.jsx`. Impossible de tester un dashboard isolément sans monter `App.jsx` entier. Si on ajoute React Router + un Context de données, chaque dashboard devient testable indépendamment avec des données mockées.

#### Interaction B : `server.js` monolithique ↔ Routes dupliquées
Le fichier `backend/routes/*.js` contient des routers Express propres (ex: `dashboard.routes.js`, `sync.routes.js`) avec validation Zod, mais `server.js` ne les utilise pas (`app.use()` manquant). Résultat : **deux implémentations coexistent**. Un bug corrigé dans `routes/` n'est pas corrigé dans `server.js`, et vice versa. C'est une bombe à retardement pour les régressions.

#### Interaction C : localStorage sans validation ↔ UX/Sécurité
Les IDs projet et milestones sont persistés en localStorage sans validation au rechargement. Si un admin supprime un milestone côté Testmo, le frontend tente de charger un ID inexistant → erreur 500 ou comportement erratique. Cela touche à la fois la robustesse (sécurité) et l'expérience utilisateur (message d'erreur non explicite).

#### Interaction D : Bundle lourd ↔ Pas de lazy loading
`html2canvas` + `jspdf` + `docx` + `recharts` sont chargés dès le démarrage. Dashboard 6 (Sync), 7 (CrossTest), 8 (Auto-sync) sont des outils administratifs utilisés occasionnellement. Le bundle initial est gonflé inutilement pour le cas d'usage principal (monitoring Dashboard 1-5). Le manque de routing empêche le lazy loading naturel par route.

#### Interaction E : Tests backend excellents ↔ Zero tests frontend
Cette asymétrie crée un **faux sentiment de sécurité**. Le métier est testé, mais l'interface utilisateur ne l'est pas. Un bug d'affichage (ex: mauvaise couleur de seuil SLA, modal qui ne ferme pas) ne sera jamais détecté automatiquement.

---

### 8.4 Vision stratégique d'évolution

Le projet est à un **carrefour**. Il a dépassé le stade de POC et est utilisé en production (livraisons R06, routines Claude, auto-sync cron). Pour passer au stade supérieur (outil d'entreprise maintenable à long terme), trois scénarios s'offrent :

#### Scénario 1 : Consolidation progressive (Recommandé)
**Objectif :** Garder le projet fonctionnel à chaque étape, sans réécriture massive.

| Phase | Durée estimée | Actions |
|-------|---------------|---------|
| **1. Fondations** | 1-2 jours | Brancher les routers existants dans `server.js`, supprimer les routes inline dupliquées. Ajouter ESLint + Prettier. Corriger la documentation. |
| **2. Tests frontend** | 3-5 jours | Ajouter Vitest + React Testing Library. Commencer par les composants pures (MetricsCards, StatusChart) puis les hooks. |
| **3. State & Routing** | 3-5 jours | Extraire Contexts (Theme, Metrics, DashboardView). Ajouter React Router. Lazy loading des dashboards admin (6-8). |
| **4. Optimisation** | 1-2 jours | Code splitting Vite, suppression de recharts, validation localStorage, remplacement alert()/confirm(). |
| **5. Industrialisation** | 1-2 jours | CI GitHub Actions, tests d'intégration supertest, hooks pre-commit. |

**Avantage :** Risque faible, livraisons continues, chaque phase apporte une valeur immédiate.

#### Scénario 2 : Refactoring frontend majeur
**Objectif :** Migrer le frontend vers une architecture moderne (TypeScript, state management, design system).

**Actions :** Migration TS, introduction de Zustand ou Redux Toolkit, composants UI réutilisables, tests E2E (Playwright).

**Risque :** Fort. Le frontend fait ~12 660 lignes de code. Une migration TS prendrait 2-3 semaines et risquerait d'introduire des régressions sans tests préalables.

#### Scénario 3 : Statu quo avec patches
**Objectif :** Ne pas toucher à l'architecture, corriger uniquement les bugs et ajouter des fonctionnalités.

**Risque :** La dette technique s'accumule exponentiellement. Chaque nouvelle fonctionnalité dans `App.jsx` ou `server.js` les rend plus difficiles à refactorer plus tard.

---

### 8.5 Analyse des risques actuels

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Régression silencieuse lors d'une modification frontend | 🔴 Élevée | 🔴 Critique | Ajouter des tests frontend avant tout refactor majeur |
| Modification d'une route dans `routes/` sans effet car `server.js` a sa copie | 🟠 Moyenne | 🟠 Élevé | Dédoublonner immédiatement (brancher les routers) |
| Crash frontend au chargement si ID localStorage invalide | 🟠 Moyenne | 🟡 Moyen | Valider les IDs au mount, fallback sur projet par défaut |
| Cron auto-sync en double si scaling horizontal | 🟡 Faible | 🟠 Élevé | Séparer le cron dans un process dédié ou utiliser un lock distribué |
| Fuite de données sensibles (pas d'authentification API) | 🟡 Faible | 🔴 Critique | Ajouter au minimum une API key ou un basic auth si exposé à Internet |
| Bundle frontend trop lourd sur mobile/réseau lent | 🟠 Moyenne | 🟡 Moyen | Lazy loading + code splitting |

---

### 8.6 Synthèse des dépendances critiques

```
┌─────────────────────────────────────────────────────────────┐
│                    GOULOTS D'ÉTRANGLEMENT                    │
├─────────────────────────────────────────────────────────────┤
│  1. App.jsx monolithique  ←────── Bloque tout le frontend   │
│  2. server.js monolithique ←───── Bloque tests intégration  │
│  3. Zero tests frontend  ←─────── Bloque refactoring sûr    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              EFFETS BOULE DE NEIGE IDENTIFIÉS               │
├─────────────────────────────────────────────────────────────┤
│  Pas de routing → Pas de lazy loading → Bundle lourd        │
│  Pas de routing → Pas de deep-linking → Mauvaise UX         │
│  App.jsx mono → Drilling props → Impossible de tester       │
│  Routes dupliquées → Double source de vérité → Régression   │
│  Zero tests → Peur de refactor → Dette qui s'accumule       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    CHEMIN DE SORTIE                         │
├─────────────────────────────────────────────────────────────┤
│  Phase 1 : Dédoublonner routes backend (quick win)          │
│  Phase 2 : Tests frontend sur composants pures              │
│  Phase 3 : Contexts + Routing + Lazy loading                │
│  Phase 4 : Optimisations (bundle, validation, a11y)         │
│  Phase 5 : Industrialisation (CI/CD, lint, integration)     │
└─────────────────────────────────────────────────────────────┘
```

---

### 8.7 Questions clés pour la suite

Avant de choisir un scénario, ces questions détermineront la priorisation :

1. **Le dashboard est-il exposé sur Internet ou uniquement en interne / VPN ?**
   - Interne uniquement → l'authentification peut attendre
   - Internet → sécurité critique (auth + HTTPS strict)

2. **Quelle est la fréquence de modification du frontend ?**
   - Modifications fréquentes → tests frontend indispensables
   - Stable (ajout de dashboards tous les 6 mois) → consolidation progressive suffit

3. **Y a-t-il des utilisateurs non-techniques qui partagent des liens vers des vues spécifiques ?**
   - Oui → le routing passe en priorité haute
   - Non → peut attendre la phase 3

4. **Le backend va-t-il scaler (PM2, Docker Swarm, K8s) ?**
   - Oui → il faut extraire le cron et remplacer le cache mémoire par Redis
   - Non (mono-instance) → pas urgent

5. **TypeScript est-il un objectif à moyen terme ?**
   - Oui → il faut l'intégrer dans la roadmap dès maintenant (même progressivement avec JSDoc)
   - Non → rester en JSX vanilla mais ajouter des types via JSDoc pour l'IDE

---

*Fin du rapport — aucune ligne de code modifiée lors de cette analyse.*
