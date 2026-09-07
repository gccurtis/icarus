# Agents reference components

Three families: the page furniture, the review gutter, and the stage.

## Page furniture

`reference-shell.svelte` frames a page: the suite header, the mast with its
readout, the note strip, and the footer. `reference-section.svelte` is one
section with a kicker, a title and a lede. `spec-table.svelte`, `flow.svelte`,
`callouts.svelte`, `file-plan.svelte` and `questions.svelte` are the shapes the
pages are argued in. `stage.svelte` frames a figure at a flank's width or the
whole workbench.

## The review gutter

`noted.svelte` is the two-column row, content then box; `note-box.svelte` is the
box, used on its own inside tables. The id is derived from a scope and the row's
label, never passed.

## The stage

`live-stage.svelte` builds a workspace state of its own from the client model,
lands it where the page asks — a content view and focus, a context panel, a
selection — and renders the real Context, Content and Inspector surfaces on it,
or just the flank the page is about. Every stage on a page has its own state, so
choosing in one does not move another, and every stage reads and writes the same
store.

The `page-*.svelte` files are the pages themselves, one per route.
