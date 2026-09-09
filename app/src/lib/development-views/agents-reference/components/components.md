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

## Specification furniture

`procedure-chain.svelte` renders one procedure whole: what it takes, what it
answers, every step with the function that performs it and the row it writes,
what it refuses and what it refreshes. It is the unit a reader has to hold to
follow a system, and the one thing a table of procedures cannot show.
`diagram.svelte` frames a mermaid diagram in the suite's own border.

## The one mock

`response-sample.svelte` draws a table and a chart as an answer should carry
them. It holds its own invented content because neither the table tool nor the
chart system exists; it is the standard they are being built to.

The `page-*.svelte` files are the pages themselves, one per route.
