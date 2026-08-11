# Change record — 2026-07-20 — Shell refinements

Polish pass on the application shell from browser review: functional icon rails,
panel sizing, seamless top chrome, tab overflow handling, and small chrome tweaks.

## Functional icon rails

```svelte
<!-- SidePanel now takes sections[{id,label,icon}] + activeSection + onselect;
     clicking a rail icon selects it (highlighted) and expands if collapsed. -->
```

**Why:** the rails were decorative. **Purpose:** make them selectable navigation.
**Why this way:** `SidePanel` moved from raw `railIcons`/`content` snippets to a
`sections` list with an `activeSection` + `onselect`; the active section highlights,
and selecting one (even while collapsed) sets it active and un-collapses. The active
section persists per project (a new `section` field on `PanelState`), and the panel
header + content follow it.

## Panel sizing

```ts
// Both panels: min = default = 220, max = 440.
```

**Why:** panels should hug the side and match. **Purpose:** same max for both, and a
narrow default (the smallest-before-collapse width). **Why this way:** context and
inspector now share `min = default = 220`, `max = 440`.

## Seamless top chrome + project name + wordmark

```svelte
<!-- TabStrip: dropped the top border. ShellTopBar: project name has no chevron;
     center wordmark extracted to <Wordmark /> (swap-point for a logo). -->
```

**Why:** the top bar and permanent destinations should read as one unit, only the
resource tabs as a separate section; the project name shouldn't look like a
dropdown, and menus should open below. **Purpose/why this way:** removed the tab
strip's top border so Overview/Resources blend into the bar; dropped the project
name's chevron (it reads as a name, menu opens on click); fixed `Menu` to `top-full`
so dropdowns open *below* the trigger; and pulled the faint wordmark into
`Wordmark.svelte` as the single place to later drop in a stylized logo/font.

## Tab overflow + Quarterback width

```svelte
<!-- TabStrip: slim custom scrollbar, wheel-to-horizontal, active-tab-into-view,
     sticky "+"; QuarterbackDock widened to max-w-3xl. -->
```

**Why:** many tabs shouldn't need a chunky scrollbar, and the QB felt narrow.
**Purpose/why this way:** the resource strip gets a sleek 5px scrollbar, vertical
wheel scrolls it horizontally, the active tab scrolls into view (centered) on
change, and the `+` is sticky so it stays reachable; the Quarterback bar widened to
`max-w-3xl`.
