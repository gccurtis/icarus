# Slide editor — implementation checklist

Detailed, granular subtasks for each phase of the slide editor build. Each item is a
single unit of work that can be verified independently. Based on
[2026-07-24-slide-editor-fabric.md](2026-07-24-slide-editor-fabric.md).

---

## Phase 1: Fabric canvas + basic shape/text

### 1a. Install and verify Fabric.js

- [x] `pnpm add fabric`
- [x] Verify import works: create a test `new fabric.Canvas()` in a Svelte component
- [x] Verify `pnpm check` and `pnpm build` pass with the new dependency

### 1b. Extend deck store with object CRUD

- [x] Add `updateSlideObject(slideId, objectId, patch)` to `systems/slides/types.ts`
  - Updates `frame`, `content`, or `style` on a specific object within a slide
- [x] Add `addSlideObject(slideId, object)` to `systems/slides/types.ts`
  - Appends a new object to the slide's objects array
- [x] Add `removeSlideObject(slideId, objectId)` to `systems/slides/types.ts`
- [x] Add `activeSlideIndex` and `activeObjectId` state to the deck store
- [x] Add `selectSlide(index)` and `selectObject(objectId)` setters
- [x] Add `newId(prefix)` helper for consistent ID generation
- [x] Add tests: `systems/slides/types.test.ts` (30 tests)

### 1c. Create FabricCanvas.svelte

- [x] Create `src/lib/features/stages/slides/FabricCanvas.svelte`
- [x] Declare props: `slide: Slide`, `deck: Deck`
- [x] Add `<canvas bind:this={canvasEl}>` with a ref
- [x] `onMount`: create `new fabric.Canvas(canvasEl)`, set dimensions from `deck.canvas`
- [x] Apply scale transform so the 960×540 deck fits the available viewport space
- [x] Build `syncToCanvas(slide)` function:
  - [x] Clear existing objects from canvas
  - [x] For each `slide.object`:
    - [x] If `kind === 'text'`: create `fabric.Textbox` with content, position, font size, alignment, color
    - [x] If `kind === 'shape'`: create `fabric.Rect` with position, size, fill, stroke
    - [x] Store the slide object's `id` on each Fabric object as a custom property (`object.slideObjectId`)
    - [x] Add to canvas
- [x] Bind Fabric events → deck store:
  - [x] `object:modified` → read `object.slideObjectId`, compute new frame, call `updateSlideObject()`
  - [x] `text:changed` → read `object.slideObjectId`, call `updateSlideObject()` with new content
  - [x] `selection:created` / `selection:updated` → call `selectObject(objectId)`
  - [x] `selection:cleared` → call `selectObject(null)`
- [x] Add reactive effect: when `slide` prop changes, call `syncToCanvas(slide)`
- [x] `onDestroy`: call `canvas.dispose()`
- [x] Handle edge case: empty slide (no objects) — canvas renders blank
- [x] Handle Fabric.js type compatibility (cast to `unknown` for custom properties)

### 1d. Create SlideActionsPanel.svelte

- [x] Create `src/lib/features/stages/slides/SlideActionsPanel.svelte`
- [x] Import `deck` store, `addSlideObject`, `activeSlideIndex`
- [x] Import Lucide icons: `Type`, `Square`
- [x] "Add text box" button with centered text default
- [x] "Add rectangle" button with fill/stroke defaults
- [x] Disable buttons when no slide is selected
- [x] Show fallback text when deck is null
- [x] Match the styling of other inspector panel sections

### 1e. Panel contributions

- [x] Publish `activeSurface.set()` in `SlideStage.svelte` `onMount`
- [x] Context sections: `[{ id: 'slides', label: 'Slides', icon: Layout, content: SlideListPanel }]`
- [x] Inspector sections: `[{ id: 'general', label: 'General', icon: SlidersHorizontal, content: SlideActionsPanel }]`
- [x] Clear via `activeSurface.set(null)` on destroy
- [x] Import `SlideListPanel`, `SlideActionsPanel`, `activeSurface` in SlideStage
- [x] Created basic `SlideListPanel.svelte` (numbered list, click to select, "+" to add)

### 1f. Rewrite SlideStage.svelte

- [x] Remove the inline `<SlideList>` component
- [x] Replace SlideCanvas with FabricCanvas
- [x] Keep the top bar (deck name, presence)
- [x] Center body: `<FabricCanvas slide={activeSlide} deck={$deck} />` filling flex-1
- [x] Use `activeSlideIndex` store instead of local `selectedSlide` state

### 1g. Create initial SlideListPanel (basic)

- [x] Create `src/lib/features/stages/slides/SlideListPanel.svelte`
- [x] Import `deck` store, `activeSlideIndex`, `selectSlide`, `addSlide`
- [x] Render a simple list of slide names (numbered)
- [x] Click to select a slide → calls `selectSlide(index)`
- [x] Highlight the active slide with action-colored border
- [x] "+" button at the top calls `addSlide()`

### 1h. Delete old files

- [x] Delete `src/lib/features/stages/slides/SlideList.svelte`
- [x] Delete `src/lib/features/stages/slides/SlideCanvas.svelte`
- [x] Verify no remaining imports reference deleted files

### 1i. Verify Phase 1

- [x] `pnpm check` → 0 errors, 0 warnings
- [x] `pnpm build` → passes
- [x] `pnpm test` → 153 passed (9 new: stage.test.ts)
- [x] Add tests: `stage.test.ts` — object append/update/remove ordering, selection clearing on slide switch, frame/content/style preservation, full slide lifecycle
- [ ] Manual verification: create a slides resource from the Overview

---

## Phase 2: Context panel — SlideListPanel thumbnails + reorder

Slides are identified by index (Slide 1, Slide 2, …). The `section` field on a slide
(optional, for future section grouping) is not shown to the user. No individual slide
names — slides are identified solely by their position.

### 2a. Thumbnail rendering

- [x] Add a CSS-scaled mini render of each slide's objects to SlideListPanel
- [x] Each thumbnail is a small `<div>` with the slide's aspect ratio, scaled down
- [x] Render text and shape objects at their scaled positions using percentage-based CSS
- [x] Show "Slide N" label below each thumbnail

### 2b. Drag-to-reorder

- [x] Add drag-and-drop behavior to slide thumbnails (native HTML DnD)
- [x] On drop, update `deck.slides` order using `reorderSlides(fromIndex, toIndex)`
- [x] Active slide index tracks the moved slide
- [x] Visual feedback during drag (opacity change on dragged item, action-colored border on drop target)
- [x] Add `reorderSlides` to deck store with index bounds checking
- [x] Add tests: `types.test.ts` — 9 tests (move forward/backward, active index tracking, same-index no-op, out-of-bounds no-op, null deck, preserve sections/objects)

### 2c. Create/delete slides

- [x] "+" button calls `addSlide()` — already implemented
- [x] Right-click on a slide thumbnail → context menu with Delete
- [x] Delete removes from `deck.slides`, selects nearest remaining slide
- [x] Edge case: deleting the only slide is prevented (at least one slide must exist)
- [x] Add `deleteSlide(index)` to deck store with active index tracking
- [x] Context menu closes on outside click, Escape key, or after action

### 2d. Verify Phase 2

- [ ] Manual: drag a slide to a new position → order persists in deck store
- [ ] Manual: right-click rename → slide name updates in list and top bar
- [ ] Manual: delete a slide → slide removed, nearest slide selected

---

## Phase 3: Inspector — object properties

### 3a. Dynamic inspector sections

- [x] When `activeObjectId` changes in the deck store, publish dynamic inspector sections
- [x] If `activeObjectId === null`: show only the "General" section (SlideActionsPanel)
- [x] If an object is selected: show "General" + object-specific sections (Text, Shape, Position)

### 3b. Text box properties

- [x] Create `TextPropertiesPanel.svelte`
- [x] Font family picker (reuse inspector font options from `systems/documents/inspector.ts`)
- [x] Font size input (number field)
- [x] Bold, italic, underline toggle buttons
- [x] Text color picker
- [x] Changes sync to the Fabric object and the deck store

### 3c. Shape properties

- [x] Create `ShapePropertiesPanel.svelte`
- [x] Fill color picker
- [x] Stroke color picker + stroke width input
- [x] Corner radius input (for rectangles)

### 3d. Object position/size

- [x] Create `ObjectPositionPanel.svelte`
- [x] X, Y position inputs
- [x] Width, height inputs
- [x] Rotation input
- [x] Z-order buttons: Bring forward, Send backward, Bring to front, Send to back

### 3e. Verify Phase 3

- [ ] Manual: select a text box → inspector shows font/size/color controls
- [ ] Manual: change font size → text box updates immediately
- [ ] Manual: select a shape → inspector shows fill/stroke controls
- [ ] Manual: deselect → inspector reverts to General only

---

## Phase 4: Polish

### 4a. Duplicate slide

- [x] Right-click → "Duplicate" on slide thumbnail
- [x] Deep-clone the slide with new IDs for slide and all objects
- [x] Insert after the current slide, select the duplicate

### 4b. Canvas background

- [x] Add a `backgroundColor` field to `Slide` in the types
- [x] SlideActionsPanel gets a "Background color" picker in the General tab
- [x] Fabric canvas applies the background color to the canvas or a background rect

### 4c. Slide notes placeholder

- [x] Add a notes field to the Slide type
- [x] Add a "Notes" inspector section with a text area placeholder
- [x] Notes are slide-scoped, not canvas objects

### 4d. Verify Phase 4

- [ ] Manual: duplicate a slide → copy appears after it with same content
- [ ] Manual: change background color → canvas updates
- [ ] Manual: switch slides → each slide retains its own background color

---

## Files created/modified summary

| File | Phase | Action |
|---|---|---|
| `package.json` | 1a | Add `fabric` |
| `systems/slides/types.ts` | 1b | Add object CRUD + selection state |
| `systems/slides/index.ts` | 1b | Export new functions |
| `features/stages/slides/FabricCanvas.svelte` | 1c | **Create** |
| `features/stages/slides/SlideActionsPanel.svelte` | 1d | **Create** |
| `features/stages/slides/SlideListPanel.svelte` | 1g+2 | **Create** |
| `features/stages/slides/SlideStage.svelte` | 1f | **Rewrite** |
| `features/stages/slides/SlideList.svelte` | 1h | **Delete** |
| `features/stages/slides/SlideCanvas.svelte` | 1h | **Delete** |
| `features/stages/slides/TextPropertiesPanel.svelte` | 3b | **Create** |
| `features/stages/slides/ShapePropertiesPanel.svelte` | 3c | **Create** |
| `features/stages/slides/ObjectPositionPanel.svelte` | 3d | **Create** |
