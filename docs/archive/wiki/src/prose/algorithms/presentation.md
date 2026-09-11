## The stage

The presentation editor draws with Konva and edits with ops, the same division the document editor makes with ProseMirror. [[file:app/src/lib/app-views/categories/presentation-editor/content/presentation.svelte]] mounts one `Konva.Stage`, one `Konva.Layer` and one `Konva.Transformer` (resize and rotate disabled; the border painted in `--token-color-active-border` through a palette probe, since a canvas cannot read a CSS variable) and, for each element of the active slide, a `Konva.Rect` or `Konva.Text`.

Geometry is in slide units. [[file:app/src/lib/app-views/categories/presentation-editor/procedures/stage.ts]] derives them from the published `presentation.*` configuration: a slide is `unitsHigh` (720) tall and `unitsHigh × ratio` wide; it is drawn `widthRem` (52 rem) wide at 100 % zoom; zoom is clamped to 50–200; the gutter is what is left over, between 0.75 and 2.5 rem; `charactersPerLine` is the width divided by the font size times an average glyph of 0.52 em. An element's `Frame` is fractional — `x`, `y`, `width`, `height` in 0..1 of the slide — and `toPixels` / `toFrame` convert at the stage boundary, so a frame stored once draws correctly at any zoom and ratio.

## Procedures over a presentation

[[file:app/src/lib/app-views/categories/presentation-editor/procedures/presentation.ts]] is pure: each function takes a `PresentationBody` and returns an `Edit` — the next body and the ops that describe it, together, so the two cannot disagree. `withElementFrame` sets one element's frame (`set` with `value` and `was`); `withNewSlide` inserts an empty slide taking its neighbour's layout; `withDuplicatedSlide` inserts a copy that shares no id with the original, written out per block kind so a `ResourceRef`'s `id` is not mistaken for a block's; `withoutSlide` removes a slide and, because a section is anchored to its first slide, re-anchors or drops the section as an op of its own; `withMovedSlide` and `stepped` reorder. A presentation has one flat id space, so an element is addressed by its own id: the path of a frame is `<elementId>/frame`.

[[file:app/src/lib/representation/data/behavior/presentations/apply-ops.ts]] is the pure applier the server and the runtime share; the document editor's equivalent lives in the capability instead.

## From procedure to op

A drag ends; `dragend` reads the node's pixel box, `toFrame` converts it, `withElementFrame` produces the ops, and `runtime.apply(moved.ops)` hands them to the presentation runtime, which buffers, coalesces and flushes exactly as the document runtime does ([[page:/algorithms/revisions|Revisions]]) — through `submitPresentationChanges` in [[file:app/src/lib/capabilities/presentation/index.remote.ts]]. The context views `presentation-editor.slides` (the reel) and `presentation-editor.stage` (zoom, ratio, metrics) read the same runtime through workspace state.
