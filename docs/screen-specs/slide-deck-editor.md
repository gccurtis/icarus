# Slide deck editor

## Purpose

The slide-deck editor presents one selected slide on a freeform canvas while keeping the deck's order, sections, layouts, theme, notes, and rich content immediately reachable. The native `SlideDeckBody` is authoritative; a canvas library supplies interaction and rendering mechanics.

## Center surface

### Resource header

The fixed editor header shows editable deck title, aspect ratio, template origin, truthful save/rebase/conflict state, and live collaborator presence only from an ephemeral presence channel. Rename is a metadata edit independent of canvas changes.

### Local toolbar

- Undo/redo.
- New Slide and layout chooser.
- Duplicate/delete/hide current slide.
- Insert rich content.
- Arrange: forward/back, front/back, align, and distribute.
- Zoom, fit slide, and presentation/preview.
- Edit slide / Edit layout mode indicator.

Text-mark controls appear when a nested text selection is active. Element geometry and formatting primarily live in the inspector.

### Canvas and pasteboard

- The selected slide is centered on a neutral pasteboard at its deck aspect ratio.
- Slide coordinates are displayed as fractions but manipulated naturally in pixels at the current zoom.
- Selection boxes provide move, resize, and rotate handles plus keyboard nudging.
- Alignment guides, snapping, and safe-area guides are view state, not persisted objects.
- Multi-selection has a clear bounding box and object count.
- Locked layout elements render on every slide and cannot be selected in Slide mode. Their own array order is defined, but cross-layer order relative to slide elements is not; foreground/background master composition needs an explicit model rule before the renderer promises one.
- Double-clicking or choosing Edit layout enters a visibly distinct Layout mode; leaving it returns to the originating slide.
- Overflow behavior—clip, shrink, or grow—is apparent during content editing and configurable in the inspector.

### Rich content inside elements

Each editable slide element holds `ContentBlock[]` and uses the same block renderer and text semantics as documents:

- Text is edited through an in-place rich-block overlay.
- Images, tables, embeds, formulas, and prompts retain their shared raw/display and provenance states.
- An element is the spatial container; a block is the standard content object inside it.
- Element frame, rotation, overflow, placeholder origin, and box format do not leak into block content.

Interaction follows a stable ladder: first click selects the element and exposes transform handles; Enter/double-click enters nested block editing; a further text selection inspects text; Escape steps outward from text to block to element to slide. Fabric pointer transforms are suspended while the block overlay owns input.

### Notes

A collapsible notes tray below the canvas edits the selected slide's notes blocks. Opening Notes in the context panel expands the tray and focuses it. Notes use the same block editor but never appear on the slide canvas.

## Context panel

| Key | Label | Contents and organization |
| --- | --- | --- |
| `slides` | Slides | Default. Ordered thumbnails grouped by contiguous sections; current section expanded. Drag/reorder, hidden state, duplicate, and [New Slide](new-slide.md). Slides have thumbnails rather than persisted names. |
| `layers` | Layers | Current slide's layout-owned and slide-owned objects in visual order, including hidden/overlapped items. Provides keyboard selection and z-order commands. Cross-layer master ordering is marked unresolved. |
| `find` | Find | Search deck text/notes/links and navigate result to slide, element, and block. Results virtualize for large decks. |
| `layouts` | Layouts | Layout gallery with apply, reset, and Edit layout. Current layout first; placeholders and locked-content summary on each card. |
| `insert` | Insert | Text, image, table, embed, formula, and prompt elements. Basics expanded; data/AI content collapsible. |
| `theme` | Theme & styles | Theme background, palette, font family, and named styles. Theme expanded; named styles collapsible. |
| `notes` | Notes | Selected slide's notes plus a compact slide-to-slide notes list. Current notes expanded. |
| `comments` | Comments | Deck, current slide, selected element, and selected text filters. Open first, resolved collapsed. |
| `context` | Context | Saved Resource Sets for prompts and copilot scope, resolved preview, and Open Context screen. |

## Inspector targets

| Selection | Expanded sections | Collapsed sections |
| --- | --- | --- |
| Deck or nothing | Identity; aspect ratio; quick New Slide | Template provenance; attribution; handout setup |
| Section | Name; first-slide anchor | Slide count; change attribution when derivable |
| Slide/background | Layout; hidden state; background | Notes summary; attribution; reset actions |
| Layout | Identity; background | Locked elements; placeholder summaries; usage |
| Locked layout element | Frame/rotation/format; nested blocks | Layout ownership; change attribution when derivable |
| Placeholder summary | Role; frame; style key; prompt | Layout ownership; read-only until placeholders have stable identity |
| Slide element | Position/size/rotation; overflow; arrange | Placeholder-role origin; reset eligibility; box format; change attribution when derivable |
| Multiple elements | Shared geometry and arrange | Mixed formatting summary |
| Nested block/text | Shared block or text inspector | Element and slide ancestry |
| Theme | Background; colors; font | Theme usage |
| Background | Color or image; fit | Inheritance path |
| Notes block | Shared block inspector | Slide ancestry |
| Handout | Paper/orientation/margins | Change attribution when derivable |
| Comment thread | State/body/replies | Anchor and attribution |

Inspector ancestry should read Deck → Slide → Element → Block → Text selection when applicable. Selecting a locked element in Layout mode identifies Layout rather than Slide as its owner.

Sections, slides, elements, and layout objects have no direct actor fields. Any nested attribution is derived from retained change sets and may be unavailable.

## Layout semantics

- A section is anchored to its first slide; reordering slides updates contiguous section interpretation.
- Deleting a section's first slide re-anchors the section to its next remaining slide; if none remains, delete the empty section. Reordering previews and commits the resulting section boundaries so no `firstSlideId` is left dangling.
- Applying a layout materializes independent slide elements from placeholders and records the placeholder role in `fromPlaceholder`.
- `SlidePlaceholder` currently has no stable key. A placeholder is therefore a read-only layout summary rather than an independently selectable canvas object, and duplicate placeholders with the same role cannot be distinguished.
- Reset to layout is available only when `fromPlaceholder` resolves to exactly one placeholder role in the current layout. Stable placeholder identity must be added before duplicate-role reset, retained placeholder selection, or granular placeholder inspection ships.
- Locked layout elements remain layout-owned and editable only in Layout mode.
- A slide background overrides layout/theme background; otherwise inheritance remains visible in the inspector.
- Duplicating a slide copies its complete slide fields and mints new IDs for the slide and every identified descendant in the same deck.

Entering Layout mode first commits or cancels any nested block edit, stores the slide selection, and starts a distinct undo group. Exiting commits the layout change set, restores the originating slide/selection when still valid, and never merges layout edits into the slide-content undo step.

## Canvas engine boundary

### Chosen baseline

[Fabric.js](https://fabricjs.com/) is the preferred free/open-source interaction engine for the first slide editor. It is MIT-licensed and supplies typed canvas objects, multi-object selection, movement, scaling, rotation, viewport transforms, and custom controls. Taurus Alpha also validated the basic adapter shape, but its mock storage and clear-and-rebuild reconciliation are not carried forward.

### Authority and mapping

- Every Fabric object maps to a stable Icarus slide-element or layout-element ID.
- Icarus fractional frames convert to canvas pixels on render and back to fractions on committed transforms.
- Fabric events become granular native change-set operations.
- Fabric JSON is never persisted and cannot become the source of truth.
- Remote changes reconcile incrementally by stable ID; do not clear and rebuild the whole canvas.
- Selection is maintained by native ID across reconciliation.
- Guides, zoom, viewport, hover, and temporary transforms remain client view state.
- The shared rich-block renderer/editor owns block content. Fabric owns the element's spatial shell and transform controls, avoiding a second text/content model.
- User, accepted-local, remote, block-display, and layout-only origins prevent subscription reconciliation from echoing as new outbound edits.
- The deck runtime, Fabric instance, block-editor state, buffered operations, and undo history survive tab view unmounting and release only on safe tab close.

The adapter must prove IME/text-overlay alignment, nested block hit testing, accessibility fallback, stable reconciliation, and Svelte lifecycle cleanup before broad feature work. Fabric is not currently installed in Icarus; this spike is a prerequisite, not completed architecture.

## States and accessibility

- The slide strip and canvas show saving/rebasing/conflict state without obscuring content.
- A hidden slide remains editable and has both an icon and text label.
- Layout mode has a persistent non-color label and exit control.
- Every canvas command has toolbar/menu/keyboard access.
- The inspector exposes exact geometry for keyboard users.
- A logical object list provides accessible navigation through slide elements and locked layout content.
- Canvas/notes scrolling reserves the shared Copilot safe area.

## Deliberate navigation choices

- Layers owns the visible object list and accessibility fallback.
- Find owns deck-wide search.
- References remain on selected link/embed/formula/prompt/source inspection.
- Rich History is deferred to change-set-derived attribution and project Activity.
- AI task navigation remains in Project Tasks and the Copilot Inspector.

## Retained tab view state

The `slides` state retains current slide, Slide/Layout mode, stable selected object IDs, zoom, viewport, Notes expansion/height, panel state, and any nested New Slide chooser state. The Fabric instance, rich-block overlay, transform gesture, undo history, and buffered operations remain in the tab runtime. Reload restores IDs that still exist, falls back to the first slide when needed, and never restores a half-completed pointer or text edit.

## Model coverage

- [Slide decks](../data-models/general-resources/slides.md)
- [Content blocks](../data-models/content/content-block.md)
- [Styles](../data-models/general-resources/style-set.md)
- [Page setup](../data-models/general-resources/page-setup.md)
- [Comments](../data-models/collaboration/comment.md)
- [New Slide](new-slide.md)
