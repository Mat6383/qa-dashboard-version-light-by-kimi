# P23 — Améliorations UX : Raccourcis clavier, Mode compact, Drag-and-drop

**Date :** 2026-04-28  
**Approche choisie :** Hybride (frontend-only, extensible vers backend)  
**Durée estimée :** 2–3 jours

---

## 1. Objectif

Améliorer l'ergonomie du QA Dashboard avec trois features indépendantes :

1. **Raccourcis clavier** — Navigation et actions rapides dans les modals/formulaires
2. **Mode compact** — Vue dense réduisant padding et marges pour le monitoring
3. **Drag-and-drop colonnes** — Réorganisation des colonnes de tableaux

Toutes les features sont **frontend-only** (`localStorage`) sans migration DB.

---

## 2. Architecture

```
frontend/src/
├── hooks/
│   ├── useGlobalShortcuts.ts      # Écoute window, dispatch actions
│   ├── useCompactMode.ts          # Toggle + persistance localStorage
│   └── useColumnOrder.ts          # DnD state + persistance par tableau
├── components/
│   ├── ShortcutHelpOverlay.tsx    # Overlay aide (?)
│   └── SortableTableHeader.tsx    # Header DnD (@dnd-kit)
└── contexts/
    └── (aucun nouveau — on garde l'existant)
```

**Principe :** chaque hook est auto-contenu, testable unitairement, et consommable par n'importe quel composant.

---

## 3. Raccourcis clavier (`useGlobalShortcuts`)

### Scope MVP

| Raccourci          | Action                          | Cible                                                   |
| ------------------ | ------------------------------- | ------------------------------------------------------- |
| `Esc`              | Fermer le modal ouvert          | Tout modal (QuickClosure, ReportGenerator, TestClosure) |
| `Enter`            | Confirmer l'action principale   | Modal avec action principale                            |
| `Ctrl+S` / `Cmd+S` | Sauvegarder le formulaire actif | Formulaires éditables                                   |
| `?`                | Ouvrir l'overlay d'aide         | Global                                                  |

### Implémentation

- Hook `useGlobalShortcuts` enregistré sur `window` dans `AppLayout.tsx`
- Système de "layers" : si un modal est ouvert, `Esc` ferme le plus récent via `activeModalRef`
- `preventDefault()` sur `Ctrl+S` **uniquement** quand `document.activeElement` est dans un `<form>` ou `contentEditable`
- `?` ignoré si `target` est un champ de saisie
- ~80 lignes de hook natif, **pas de bibliothèque externe**

---

## 4. Mode compact (`useCompactMode`)

### Mécanisme

- Toggle dans `AppLayout` (icône à côté des toggles dark mode / TV mode)
- Classe `.compact-mode` sur `<body>` (même pattern que `.dark-mode`)
- CSS variables scopées :

```css
:root {
  --section-padding: 2rem;
  --card-padding: 1.5rem;
  --metric-font-size: 2.5rem;
  --table-row-height: 64px;
}

.compact-mode {
  --section-padding: 0.75rem;
  --card-padding: 0.5rem;
  --metric-font-size: 1.5rem;
  --table-row-height: 36px;
}
```

### Persistance

- `localStorage.setItem('testmo_compactMode', 'true')`
- Synchronisation cross-tab via `window.addEventListener('storage')`
- Pas de feature flag — toggle utilisateur classique

### Impact

- `AppLayout` : header réduit
- `MetricCard` : padding + font-size réduits
- Tableaux virtualisés (`Dashboard7`, `AuditLogViewer`) : `row-height` réduite (compatible `@tanstack/react-virtual`)
- Charts : height réduit

---

## 5. Drag-and-drop colonnes (`useColumnOrder` + `@dnd-kit`)

### Bibliothèque

`@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`

- Léger, accessible, support clavier natif

### Scope (2–3 tableaux max)

1. **Dashboard7** (CrossTest issues)
2. **AuditLogViewer**
3. _(Optionnel)_ **MultiProjectDashboard**

### Mécanisme

- Chaque tableau définit son `columnOrder` initial
- `useColumnOrder(tableId)` retourne `{ columns, sensors, handleDragEnd }`
- Persistance : `localStorage.setItem('testmo_columns_<tableId>', JSON.stringify(order))`
- Restauration au mount

### Composant réutilisable

```tsx
// SortableTableHeader.tsx
// Encapsule <DndContext> + <SortableContext> + useSortable
// Props : columns, onReorder, tableId
```

### Accessibilité

- `role="button"` + `aria-describedby="drag-instructions"` sur les headers
- Support clavier natif `@dnd-kit` (Space pour lift, flèches pour déplacer)

---

## 6. Data Flow

Aucune donnée ne quitte le navigateur.

```
App mount
   └─► useCompactMode() ──► lit 'testmo_compactMode' ──► applique .compact-mode
   └─► useGlobalShortcuts() ──► écoute keydown sur window
   └─► Dashboard7 mount
        └─► useColumnOrder('crosstest') ──► lit 'testmo_columns_crosstest'
```

**Broadcast cross-tab** : chaque hook écoute `storage` pour synchroniser entre onglets.

**Migration future** : remplacer `localStorage` par `useQuery` tRPC dans chaque hook sans changer leur API externe.

---

## 7. Error Handling & Accessibilité

| Risque                                    | Mitigation                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `Ctrl+S` intercepte sauvegarde navigateur | `preventDefault()` uniquement quand `document.activeElement` est dans un `<form>` ou `contentEditable` |
| DnD casse le layout table                 | Headers en `display: flex`, `touch-action: none`, largeurs fixes                                       |
| DnD inaccessible clavier                  | `@dnd-kit` gère nativement + `aria-describedby`                                                        |
| `?` conflit avec saisie texte             | Ignoré si `target` est `<input>`, `<textarea>`, ou `contentEditable`                                   |
| Compact mode illisible                    | Minima : `0.75rem` padding, `14px` font-size                                                           |

---

## 8. Testing Strategy

| Hook/Composant        | Type de test            | Couverture                                             |
| --------------------- | ----------------------- | ------------------------------------------------------ |
| `useGlobalShortcuts`  | Vitest (hook testing)   | `Esc`, `Ctrl+S` conditionnel, `?` overlay              |
| `useCompactMode`      | Vitest                  | Toggle, persistance, broadcast                         |
| `useColumnOrder`      | Vitest                  | Réordonner, persistance, restauration                  |
| `SortableTableHeader` | Vitest + RTL            | Render, drag simulation                                |
| `ShortcutHelpOverlay` | Vitest                  | Render, fermeture `Esc`                                |
| **Intégration**       | Playwright E2E (1 test) | Compact mode → DnD colonnes → persistance après reload |

---

## 9. Livrables

- `frontend/src/hooks/useGlobalShortcuts.ts`
- `frontend/src/hooks/useCompactMode.ts`
- `frontend/src/hooks/useColumnOrder.ts`
- `frontend/src/components/ShortcutHelpOverlay.tsx`
- `frontend/src/components/SortableTableHeader.tsx`
- Mises à jour CSS dans `frontend/src/App.css`
- Mises à jour `AppLayout.tsx` (toggle compact + overlay)
- Tests unitaires + E2E
- Mise à jour `ROADMAP.md`

---

## 10. Dépendances

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

---

## 11. Non-goals (hors scope)

- Persistance serveur des préférences (peut être ajouté en P24+)
- DnD de lignes (réordonner des issues CrossTest)
- DnD de cartes/métriques entre dashboards
- Raccourcis de navigation entre dashboards (`1-9`) — future enhancement
