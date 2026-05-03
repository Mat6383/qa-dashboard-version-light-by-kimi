# UI Color Harmonization & GitHub Dark Theme Design

## Overview

Refonte complète de la palette graphique de l'application QA Dashboard pour adopter une direction **Tech / GitHub Dark** avec harmonisation des couleurs sur tous les dashboards et une logique de seuils cohérente pour les indicateurs de pourcentage.

## Goals

1. Unifier la palette de couleurs sur tous les dashboards et écrans
2. Implémenter un thème sombre profond type GitHub Dark (`#0A0A0A`, `#111111`) et un light mode tech (`#F6F8FA`)
3. Harmoniser la logique de couleurs par seuil sur toutes les métriques (3 niveaux : danger / warning / success)
4. Remplacer les couleurs actuelles désordonnées par des tokens sémantiques cohérents
5. Améliorer l'accessibilité et le contraste

## Visual Direction

### Ambiance : Tech / GitHub Dark

- Fonds très sombres presque noirs en dark mode, blanc cassé tech en light mode
- Accents cyan électrique (`#06B6D4`) pour la marque et les interactions
- Status colors néon et saturés : vert `#4ADE80`, jaune `#FBBF24`, rouge `#F87171`
- Bordures fines (`#21262D` dark / `#D0D7DE` light)
- Typographie nette, pas de glassmorphism, pure efficacité technique

### Palette complète

#### Surfaces (Dark)

| Token                | Valeur    | Usage              |
| -------------------- | --------- | ------------------ |
| `--surface-canvas`   | `#0A0A0A` | Fond de page       |
| `--surface-default`  | `#111111` | Cartes, panels     |
| `--surface-elevated` | `#161B22` | Éléments surélevés |
| `--surface-muted`    | `#0D1117` | Fonds secondaires  |
| `--border-default`   | `#21262D` | Bordures           |
| `--border-subtle`    | `#30363D` | Séparateurs        |

#### Surfaces (Light)

| Token                | Valeur    | Usage              |
| -------------------- | --------- | ------------------ |
| `--surface-canvas`   | `#F6F8FA` | Fond de page       |
| `--surface-default`  | `#FFFFFF` | Cartes, panels     |
| `--surface-elevated` | `#FFFFFF` | Éléments surélevés |
| `--surface-muted`    | `#F3F4F6` | Fonds secondaires  |
| `--border-default`   | `#D0D7DE` | Bordures           |
| `--border-subtle`    | `#E5E7EB` | Séparateurs        |

#### Texte (Dark)

| Token              | Valeur    |
| ------------------ | --------- |
| `--text-default`   | `#E6EDF3` |
| `--text-secondary` | `#8B949E` |
| `--text-muted`     | `#6E7681` |
| `--text-inverse`   | `#0A0A0A` |

#### Texte (Light)

| Token              | Valeur    |
| ------------------ | --------- |
| `--text-default`   | `#1F2328` |
| `--text-secondary` | `#57606A` |
| `--text-muted`     | `#8C959F` |
| `--text-inverse`   | `#FFFFFF` |

#### Accents & Status

| Rôle                     | Light     | Dark      |
| ------------------------ | --------- | --------- |
| `--accent-primary`       | `#06B6D4` | `#22D3EE` |
| `--accent-primary-hover` | `#0891B2` | `#67E8F9` |
| `--status-success`       | `#16A34A` | `#4ADE80` |
| `--status-success-bg`    | `#DCFCE7` | `#14532D` |
| `--status-warning`       | `#D97706` | `#FBBF24` |
| `--status-warning-bg`    | `#FEF3C7` | `#78350F` |
| `--status-danger`        | `#DC2626` | `#F87171` |
| `--status-danger-bg`     | `#FEE2E2` | `#7F1D1D` |
| `--status-info`          | `#2563EB` | `#60A5FA` |

## Threshold Logic (Tous Dashboards)

### Métriques "Plus c'est mieux" (Pass Rate, Completion Rate, Test Efficiency, Detection Rate)

| Niveau  | Seuil                       | Couleur            |
| ------- | --------------------------- | ------------------ |
| Success | ≥ target (95%)              | `--status-success` |
| Warning | ≥ warning (85%) et < target | `--status-warning` |
| Danger  | < warning (85%)             | `--status-danger`  |

### Métriques "Moins c'est mieux" (Failure Rate, Escape Rate, Blocked Rate)

| Niveau  | Seuil                       | Couleur            |
| ------- | --------------------------- | ------------------ |
| Success | ≤ target (5%)               | `--status-success` |
| Warning | ≤ warning (10%) et > target | `--status-warning` |
| Danger  | > warning (10%)             | `--status-danger`  |

### Exceptions

- **Escape Rate** : target 5%, warning 10%
- **Detection Rate (DDP)** : target 95%, warning 85%
- **Blocked Rate** : target 5%, warning 10%
- **Completion Rate** : target 90%, warning 80%
- **Pass Rate** : target 95%, warning 85%
- **Test Efficiency** : target 95%, warning 85%
- **Failure Rate** : target 5%, warning 10%

## Files to Modify

### Tokens & Styles

- `frontend/src/styles/tokens.css` — Nouveaux tokens sémantiques
- `frontend/src/styles/App.css` — Mise à jour des alias legacy

### Utilities

- `frontend/src/lib/colors.ts` (NEW) — Fonction `getMetricColor(metric, value)`
- `frontend/src/lib/colors.test.ts` (NEW) — Tests unitaires

### Dashboards & Components (all updated to use tokens + utility)

- `frontend/src/components/PreprodSection.tsx`
- `frontend/src/components/ProductionSection.tsx`
- `frontend/src/components/MetricsCards.tsx`
- `frontend/src/components/Dashboard4.tsx`
- `frontend/src/components/Dashboard5.tsx`
- `frontend/src/components/TvDashboard.tsx`
- `frontend/src/components/MultiProjectDashboard.tsx`
- `frontend/src/components/CompareDashboard.tsx`
- `frontend/src/components/MetricCard.tsx`
- `frontend/src/components/StatusChart.tsx`
- `frontend/src/components/AppLayout.tsx`

## Implementation Notes

- Remplacer toutes les valeurs hex en dur par des `var(--token)`
- Supprimer les logiques de couleur inline dispersées dans les composants
- Utiliser `getMetricColor()` pour toute décision de couleur basée sur un seuil
- Garder la compatibilité avec le `tvMode` existant
- Les graphiques Chart.js recevront les couleurs via les tokens
