# Slide editor build, shared UI variants, and document-doc alignment

Commits the outstanding working-tree work that accompanied the document-editor changes: the
Fabric-based slide editor and its inspector panels, a few shared UI additions the slide UI
uses, and small updates to the document discrepancy/backend-request docs reflecting the
now-un-mocked inspector controls. (Slides is a front-end mock editor — no Omega deck model
yet — so this is all client-side.)

## Slide editor — canvas, deck store, and inspector panels

The slide editor (`src/lib/features/stages/slides/`) is a Fabric.js-backed editor over a
mock deck store (`src/lib/systems/slides/types.ts`):

- **FabricCanvas** renders the active slide, fits/zooms it to the work area (leaving a gutter),
  and streams object moves/resizes/text edits and selection back into the deck store. (The
  earlier fix here made the canvas scale via Fabric's own `setZoom`/`setDimensions` instead of
  a CSS transform, and pinned object origin to top-left so objects don't shift.)
- **Deck store** — `Deck`/`Slide`/`SlideObject` shapes plus immutable mutators: slide add /
  delete / duplicate / reorder / section / background / notes, object add / update / remove,
  z-order (bring-forward/backward/to-front/to-back), and the `activeSlideIndex`/`activeObjectId`
  selection stores.
- **Inspector panels** — `SlideActionsPanel` (add text/rectangle, slide background),
  `SlideListPanel` (New/Delete/AI toolbar, drag-reorderable live thumbnails, right-click
  Duplicate/Delete), and the object-property panels `TextPropertiesPanel`,
  `ShapePropertiesPanel`, `ObjectPositionPanel`, and `NotesPanel`, contributed to the shell's
  inspector/context rails by `SlideStage`.
- **Tests** — `stage.test.ts` covers the deck store's slide/object/z-order/selection operations.

Every hand-authored file carries its `.md` companion.

## Shared UI — Button variants and side-panel collapse

- **Button** gains `danger-secondary`, `intel-secondary`, and `plain` variants plus a
  `borderless` prop — the quiet, bordered-on-hover styles the slide-list toolbar uses.

```svelte
'danger-secondary': 'text-primary border border-transparent hover:text-danger hover:border-danger/40 …',
'intel-secondary':  'text-primary border border-transparent hover:text-intel  hover:border-intel/40  …',
'plain':            'text-primary border border-transparent hover:border-border hover:bg-elevated …',
```

- **SidePanel** — clicking the *already-active* section now collapses the panel (instead of
  re-selecting it), so the section button toggles:

```svelte
onclick={() => {
  if (activeSection === s.id && !collapsed) ontoggle(true);
  else onselect(s.id);
}}
```

## Document docs — reflect the un-mocked inspector controls

Small updates to `docs/backend-requests/document-context.md`,
`docs/backend-requests/document-inspector.md`, `docs/discrepancies/document-inspector.md`, and
`docs/discrepancies/documents.md` so the discrepancy/request notes match reality now that
alignment, line-spacing, columns, and quote are real changeset ops (see the document-editor
commit and `docs/integration/current/`).
