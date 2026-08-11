# Slide editor — Fabric.js integration plan

**Status:** Planned. Replaces the current CSS mock with a Fabric.js canvas editor
supporting shape/text box creation, drag positioning, inline rich text, and panel
contributions via the surface system.

## Target architecture

```
SlideStage.svelte                           ← owns the stage, publishes panel sections
├── Top bar (deck name, presence, save)     ← already built (matches DocumentStage)
├── FabricCanvas.svelte                     ← mounts Fabric.js, bridges data model
│   └── <canvas> ref → fabric.Canvas        ← objects: Textbox, Rect, Ellipse
└── Panel contributions (via surface.ts)    ← published on mount, cleared on destroy
    ├── Context (left rail): SlideListPanel ← thumbnails, select, drag-reorder, create
    └── Inspector (right rail): General tab ← add text box, add rectangle
```

## Why Fabric.js

The slides data model (`docs/support/slides-v1.md`) requires inline rich text —
bold, italic, color within a text block (`TextRun` + `Mark`). Fabric's `IText`/`Textbox`
provides this. Konva's `Text` is single-style only.

Fabric's imperative canvas-ref pattern is identical to how the document editor mounts
ProseMirror — no wrapper library needed.

## Data flow

```
deck store (systems/slides/types.ts)  ←→  Fabric canvas (FabricCanvas.svelte)
       │                                        │
       │  slide.objects[id].frame               │  object:modified event
       │  slide.objects[id].content             │  text:changed event
       │  slide.objects[id].style               │  selection:created event
       │                                        │
       └────────── single source of truth ──────┘
               │
               ▼
    Panel components read from deck store
    (SlideListPanel, SlideActionsPanel)
```

## Phase 1: Fabric canvas + basic shape/text

### 1a. Install Fabric.js
```bash
pnpm add fabric
```
Fabric 7.x ships ESM (`import { Canvas, Rect, Textbox } from 'fabric'`).

### 1b. Create FabricCanvas.svelte
Mounts a Fabric.js instance on a `<canvas>` ref. Renders slide objects from the deck
store. Binds Fabric events back into the store.

**Props:** `slide: Slide`, `deck: Deck`

**Render objects:**
- `kind: 'text'` → `new fabric.Textbox(content, { left, top, width, height, fontSize, textAlign, fill })`
- `kind: 'shape'` → `new fabric.Rect({ left, top, width, height, fill, stroke })`

**Fabric events → deck store:**
- `object:modified` → update `slide.objects[id].frame`
- `text:changed` → update `slide.objects[id].content`
- `selection:created/updated` → publish selection state for inspector

### 1c. Create SlideActionsPanel.svelte
Inspector panel "General" section with add text box / add rectangle buttons. Each
action calls a deck store function, then the Fabric canvas adds the new object.

### 1d. Panel contributions
Publish via `activeSurface.set()` in SlideStage on mount:
- Context: `SlideListPanel` (basic list for now, thumbnails in Phase 2)
- Inspector: `SlideActionsPanel` (General tab)

### 1e. Rewrite SlideStage.svelte
Slim to: top bar + `<FabricCanvas>` + panel publishing. Remove inline slide list
and inline actions — both move to panels.

## Phase 2: Context panel — SlideListPanel

### 2a. Thumbnail rendering
CSS-scaled mini renders of each slide's objects. Lightweight — same approach as the
current mock.

### 2b. Drag-to-reorder
Svelte drag-and-drop. On drop, reorder `deck.slides` and update the Fabric canvas's
active slide index.

### 2c. Create/rename/delete slides
"+" button calls `addSlide()`. Right-click context menu for rename (inline edit) and
delete.

## Phase 3: Inspector — object properties

When a Fabric object is selected, display its properties in the inspector. Text boxes
show font/size/color/bold/italic. Shapes show fill/stroke/corner radius. All objects
show position/size/rotation/z-order.

## Phase 4: Polish

Duplicate slides, canvas background color, slide notes placeholder.

## Architecture decisions

- **Canvas ref over svelte wrapper** — same pattern as ProseMirror in DocumentStage
- **Deck store as single source of truth** — Fabric is a view, not the authority
- **Panel sections via activeSurface** — same system as the document editor
- **No Omega persistence yet** — all state is local mock in the deck store

## Files affected

| File | Action |
|---|---|
| `package.json` | Add `fabric` dependency |
| `systems/slides/types.ts` | Extend with object CRUD actions, selection state |
| `features/stages/slides/FabricCanvas.svelte` | **New** — Fabric.js integration |
| `features/stages/slides/SlideListPanel.svelte` | **New** — context panel slide list |
| `features/stages/slides/SlideActionsPanel.svelte` | **New** — inspector actions |
| `features/stages/slides/SlideStage.svelte` | **Rewrite** — slim to top bar + canvas + panels |
| `features/stages/slides/SlideList.svelte` | **Delete** — replaced by SlideListPanel |
| `features/stages/slides/SlideCanvas.svelte` | **Delete** — replaced by FabricCanvas |
