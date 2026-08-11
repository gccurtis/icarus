# Change record — 2026-07-20 — Tab multi-select + resource types

Tab multi-selection (shift/cmd-click, Delete to close, drag the group), the core
resource types with a "New" menu on the Overview stage, and Overview as the default
tab when the last resource tab closes.

## Tab multi-select

```ts
// TabStrip: shift-click = range, cmd/ctrl-click = toggle; Delete/Backspace closes
// the selection; drag a selected tab moves the group (workspace.moveTabs).
```

**Why:** managing many tabs one-by-one is slow. **Purpose:** select several resource
tabs and act on them together. **Why this way:** a `selected` set + `anchorId` drive
range/toggle selection; a window `keydown` closes the selection on Delete/Backspace
(ignored while typing) and clears it on Escape; dragging a selected tab reorders the
whole group via the new `moveTabs`. Selected chips get a tinted, ringed style; the
context menu's close item becomes "Close N selected".

## Core resource types + New menu

```ts
// resources.ts: ResourceKind = document | spreadsheet | slides | chat | board | general
// OverviewStage: a "New" menu creates + opens a typed resource tab.
```

**Why:** the Overview stage should create real resource types. **Purpose:** the core
creatable types are document, spreadsheet, slides, chat, and board, with **general**
as a catch-all for other files (dataset/note/knowledge dropped). **Why this way:** a
primary **New** menu lists the five types; picking one adds a resource and opens it as
a tab. Each kind has its own icon + semantic tone in the table.

## Overview is the default tab

```ts
// closeTab: on closing the active tab, move to the nearest remaining resource tab,
// else default to 'overview' (never agents).
```

**Why:** closing all resource tabs shouldn't land on Agents. **Purpose/why this
way:** `closeTab` now prefers the nearest remaining resource tab and otherwise
defaults to **Overview** — closing a non-active tab still leaves the current tab put.
