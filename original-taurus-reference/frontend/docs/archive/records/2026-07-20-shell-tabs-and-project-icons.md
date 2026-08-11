# Change record — 2026-07-20 — Shell: status bar, tab UX, project icons

Second shell polish pass from review: removed the status bar, richer tab
interactions (right-click menu + drag reorder), and a project-icon feature.

## Removed the status bar

```svelte
<!-- StatusBar deleted; a faint "Taurus" corner mark replaces it in AppShell. -->
```

**Why:** the status bar was in the way and a little messy. **Purpose/why this way:**
deleted `StatusBar.svelte`; the shell keeps a whisper of branding via a faint,
non-interactive "Taurus" mark in the bottom-right corner (not "Taurus Alpha").

## Tab interactions — context menu + drag reorder

```ts
// workspace.ts: closeOthers, closeRight, moveTab.
// TabStrip: right-click → { New tab, Duplicate, Close, Close others, Close right };
//           chips are draggable to reorder; "+" stays sticky-right.
```

**Why:** tabs needed quicker actions and reordering. **Purpose:** a right-click menu
(one option is New tab) and left-drag reordering. **Why this way:** new store ops
back the menu (`closeOthers`/`closeRight`) and drag (`moveTab`, guarded to closeable
tabs); the menu is a cursor-positioned card; chips use native drag with a drop-target
ring; the sticky `+` stays reachable as tabs overflow.

## Project icons

```ts
// projects.ts: Project.icon (IconColor), persisted per id in localStorage;
// iconDotClass/iconTileClass; setProjectIconMock. Settings modal picks the color.
```

**Why:** the top-left dot should be a real, settable project icon. **Purpose:** a
per-project icon color shown as the top-bar dot and the projects-list tile, changed
from the settings modal. **Why this way:** it's client-only today (no backend field),
persisted per project id in localStorage (strict isolation), badged "Mock" in
settings; the color→class maps are literals so Tailwind emits them. A backend `icon`
field is filed under `docs/backend-requests/project-updates.md`.
