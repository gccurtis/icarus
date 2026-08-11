# Change record — 2026-07-21 — Document page chrome: floating paper, thin bar, gutters

Reshapes the document stage's presentation from "a text column with a big title" into a
**page metaphor**. No data-model or sync changes — `DocumentStage.svelte` (+ companion)
only, with the architecture entry and discrepancy updated in the same change.

## The paper on the desk

The stage surround is now the darker **canvas** surface, and the document is a floating
**paper**: `bg-work` + border + `shadow-panel`, `max-w-3xl`, with real page margins
(`px-14 py-12`). Collapsing/adjusting side panels changes only the surround — the page
measure never reflows.

The paper is at least one **US-Letter-proportioned page** tall (62rem at the 48rem page
width), and faint hairlines mark each page-height multiple — a *visual print guide
only*: the data model isn't paginated and blocks aren't measured or split. (An honest
lightweight take on "know what fits on a page"; real pagination can come later.)

## Thin document bar instead of the giant title

The in-page `text-h1` title (and "Document" eyebrow) is gone — it was the document's
**name**, not its title, and the page shouldn't be opinionated about titles. A **thin
sticky bar** above the page now carries the name (truncating) and metadata — currently
the live save status; more can join it.

## Gutters outside the page

The page itself stays clean; affordances live in the surround margin:

- **Left**: hovering a block reveals a **block-select anchor** (grip) aligned to it —
  clicking applies a ProseMirror `NodeSelection` (soft action-colored ring via
  `.ProseMirror-selectednode`). This is the anchor drag-reorder will later hang off.
- **Right**: each `prompt`-kind block gets an intel-colored **AI indicator** aligned to
  it (display-only until the resolve flow lands).

Mechanics: pointer position → `posAtCoords` → top-level block → measure its DOM top
relative to the wrapper; prompt indicators re-measure on every doc change (rAF) and on
resize (ResizeObserver). Positions are in-flow offsets, so scrolling needs no
listeners. Clicking empty paper focuses the editor.

## Docs kept in step

`architecture/document-editor.md` (stage box, open-flow, invariant 5, extension map) and
`discrepancies/documents.md` (prompt indicator; select-anchor-but-no-reorder) updated in
this change.

## Verification

`pnpm check` → 0 errors / 0 warnings; `pnpm build` → clean (`doc-paper` +
`repeating-linear-gradient` confirmed in the emitted CSS).
