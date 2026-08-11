# inspector-options.ts

Three fixed option lists shared across inspector-style panels: the font choices, the
reference-type choices, and the twelve-swatch color palette.

They lived in `systems/documents/inspector.ts` until workstream D (catalog L5), which was a
layering lie: the slide editor's panels imported them *from the documents system*, but nothing
about "IBM Plex Sans" or a pastel swatch grid is document-domain knowledge. They are
cross-feature UI vocabulary, so they live in `features/shared/` beside the other per-feature
tables (`kinds.ts`, `transfer.ts`).

Consumers: the document panels (`LayoutPanel`, `TypographyControls`, `ColorPopover`) and the
slides panels (`TextPropertiesPanel`, `SlideActionsPanel`, `ShapePropertiesPanel`). The
`document`/`name` reference entries stay labelled `(Mock)` because those reference kinds remain
blocked on the backend (see backend-contract.md).
