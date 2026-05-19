# 🌑 Design System — Dark Mode Rules

> **Scope** : QA Dashboard v3+ (React + CSS Custom Properties)  
> **Last updated** : 2026-05-19  
> **Author** : Kimi Code CLI (applied during Campagnes Actives visibility fix)

---

## 1. Core Principle

**Elevation in dark mode is expressed through lightness, not shadow.**

Unlike light mode where white cards pop against a light gray background via shadows, dark mode surfaces must become _lighter_ as they rise in elevation. Pure black (`#000000`) and near-pure black (`#0a0a0a`) destroy this hierarchy and cause eye strain.

### Why?

- **Material Design 3** : "In dark themes, surfaces at higher elevations become lighter." ([source](https://m3.material.io/styles/color/the-color-system/color-roles))
- **GitHub Primer** : Dark surfaces use `#0d1117` → `#161b22` → `#21262d` hierarchy. ([source](https://primer.style/foundations/color/overview))
- **Apple HIG** : System dark backgrounds use `#1C1C1E` (secondary) and `#2C2C2E` (tertiary). ([source](https://developer.apple.com/design/human-interface-guidelines/color))
- **WCAG 2.2** : Contrast ratios must remain ≥ 4.5:1 for normal text; crushed blacks make this impossible.

---

## 2. Surface Hierarchy (Mandatory)

Use this exact ladder for all new dark theme surfaces:

| Level            | Token                | Hex       | Usage                                      |
| ---------------- | -------------------- | --------- | ------------------------------------------ |
| Page background  | `--surface-page`     | `#0d1117` | `<body>`, `.app` root                      |
| Default surface  | `--surface-default`  | `#161b22` | Cards, panels, modals                      |
| Elevated surface | `--surface-elevated` | `#1c2128` | Hover states, dropdowns, tooltips          |
| Muted surface    | `--surface-muted`    | `#111820` | Nested containers, striped rows            |
| Hover surface    | `--surface-hover`    | `#21262d` | `:hover`, `:focus` backgrounds             |
| Active surface   | `--surface-active`   | `#30363d` | Pressed states, progress track backgrounds |

### ❌ Anti-patterns

- `--surface-page: #000000` — pure black causes halation and kills contrast
- `--surface-default: #111111` — too close to page, no card separation
- `--surface-muted` darker than `--surface-default` — inverts elevation logic

---

## 3. Border & Divider Rules

Borders must be visible enough to define edges but subtle enough to not scream.

| Token             | Hex       | Usage                                          |
| ----------------- | --------- | ---------------------------------------------- |
| `--border-color`  | `#3d444d` | Primary borders (cards, inputs, buttons)       |
| `--border-subtle` | `#484f58` | Hover borders, separators inside cards         |
| `--divider-color` | `#21262d` | Section dividers, `<hr>`, table row separators |

### Rule of thumb

If you can't see the border at 1m from the screen on a calibrated display, it's too subtle.

---

## 4. Text Colors (Cool Off-Whites)

| Token              | Hex       | Usage                                     |
| ------------------ | --------- | ----------------------------------------- |
| `--text-default`   | `#e6edf3` | Headings, primary body text               |
| `--text-secondary` | `#9ca3af` | Labels, descriptions                      |
| `--text-muted`     | `#8b949e` | Placeholders, disabled states, timestamps |

### Why cool whites?

Warm whites (`#fff5e6`) clash with neon accent colors. Cool whites (`#e6edf3`) reduce halation on OLED screens and align with GitHub/Linear dark themes.

---

## 5. Component-Specific Rules

### 5.1 Card Containers (e.g., `.pp-campaigns`, `.chart-container`)

```css
.dark-theme .card-container {
  background: var(--surface-muted); /* darker than inner cards */
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-elevated); /* darker, more diffuse shadows */
}
```

### 5.2 Inner Cards (e.g., `.pp-campaign-card`, `.kpi-card`)

```css
.dark-theme .inner-card {
  background: var(--surface-default); /* lighter than container */
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-card);
}

.dark-theme .inner-card:hover {
  background: var(--surface-hover);
  border-color: var(--border-color);
  box-shadow: var(--shadow-elevated);
}
```

### 5.3 Inline Styles (React)

**Never force `backgroundColor` inline on generic cards.** Let CSS classes handle the theme hierarchy. Only use inline styles for:

- Dynamic data colors (progress bars, status badges)
- Conditional accent backgrounds (exploratory sessions, alerts)

```tsx
// ✅ GOOD — let CSS handle the base background
const cardStyle: React.CSSProperties = {
  backgroundColor: run.isExploratory ? 'rgba(139, 92, 246, 0.14)' : undefined, // CSS class provides --surface-default
};

// ❌ BAD — overrides dark-theme hierarchy
const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--surface-default)', // same as container!
};
```

---

## 6. Shadow Behavior in Dark Mode

Shadows still exist in dark mode but are much heavier and darker:

```css
:root {
  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2);
  --shadow-elevated: 0 4px 6px -1px rgba(0, 0, 0, 0.35), 0 2px 4px -2px rgba(0, 0, 0, 0.25);
  --shadow-floating: 0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.3);
}
```

Do **not** remove shadows in dark mode — they provide depth on non-OLED screens where pure black backgrounds already have infinite contrast.

---

## 7. Accessibility Checklist

Before shipping any dark mode change, verify:

- [ ] `--text-default` on `--surface-default` ≥ 4.5:1 (actual: ~12:1 ✅)
- [ ] `--text-secondary` on `--surface-default` ≥ 4.5:1 (actual: ~6.5:1 ✅)
- [ ] `--text-muted` on `--surface-default` ≥ 3:1 for large text (actual: ~4.8:1 ✅)
- [ ] `--border-color` visible against adjacent surfaces at 100% brightness
- [ ] Hover states change both background **and** border color
- [ ] No inline `backgroundColor` overrides generic card surfaces

---

## 8. Related Files

| File                                     | Role                                                 |
| ---------------------------------------- | ---------------------------------------------------- |
| `frontend/src/styles/tokens.css`         | Source of truth for all color tokens                 |
| `frontend/src/styles/App.css`            | App-level theme overrides (`.app.dark-theme`)        |
| `frontend/src/contexts/ThemeContext.tsx` | Theme state provider (localStorage + system sync)    |
| `frontend/src/styles/PreprodSection.css` | Example of component-level dark overrides            |
| `frontend/src/styles/KPICard.css`        | Reference implementation (uses `--surface-elevated`) |

---

## 9. Sources & References

1. **Material Design 3 — Dark Theme**  
   https://m3.material.io/styles/color/the-color-system/color-roles

2. **GitHub Primer — Color Foundations**  
   https://primer.style/foundations/color/overview

3. **Apple Human Interface Guidelines — Dark Mode**  
   https://developer.apple.com/design/human-interface-guidelines/color

4. **WCAG 2.2 — Contrast Minimum (1.4.3)**  
   https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum

5. **Linear App — Dark UI Best Practices (industry reference)**  
   Observed via linear.app dark theme implementation (surface hierarchy `#0F1115` → `#1A1D24` → `#22262E`)

6. **Refactoring UI — Steve Schoger & Adam Wathan**  
   Chapter 6: "Borders are a last resort" — prefer background contrast over borders for separation.

---

## 10. Changelog

| Date       | Change                                                       | Commit context                                   |
| ---------- | ------------------------------------------------------------ | ------------------------------------------------ |
| 2026-05-19 | Initial rules extracted from Campagnes Actives dark-mode fix | Fixed invisible card hierarchy in PreprodSection |
