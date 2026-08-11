# 2026-07-27 — Pagination removed; one presentation pass (workstream B)

Workstream **B** of the [document-subsystem reorg](../plans/2026-07-27-document-subsystem-reorg.md):
the product renders one continuous flow and never paginates, yet a full page-fitting engine
(plus never-wired windowing scaffolding) ran on every keystroke. All of it is gone. What
survives is the presentation that is real — line spacing, alignment, column widths, typography,
indent — computed in **one** pass instead of two.

Catalog items closed: **P-1** (two doc-walks per transaction), **P-3** (windowing scaffolding),
**D1** (pagination stack), **D2** (`DocumentRowRepository`), **D3** (`ensurePageRange` /
`requestedRowWindow`).

## Deleted

```
src/lib/features/stages/document/pagination/   geometry, paginate, page-index, viewport,
                                               pagination-policy, row-repository (+ companions)
src/lib/features/stages/document/editor/pagination-plugin.ts (+ companion)
e2e/document-pagination.spec.ts                (tested the deleted stack; no longer loaded under
                                                Node at all — app-source imports pull .svelte)
```

Plus the page sheets and scroll-driven page windowing in `DocumentStage`, the "Pages" metric in
`InfoPanel`, the page-geometry controls in `LayoutPanel`, the `taurus-page-break` CSS, the dead
`RowManifestEntry` type, and — from the session contract — `pages`, `pagePlan`,
`requestedRowWindow`, the print-string `pageLayout`, and the `setPageLayout` action.

## The two doc-walks collapse into one

```ts
// runtime.ts — was refreshPagination (walk #1) feeding decorations while
// updateSession (walk #2) rebuilt overlapping heights from pageMetrics.
/** The ONE presentation pass: recompute per-row/per-block presentation from
 *  server truth + optimistic pending edits, and store it as decorations. */
private refreshPresentation(force = false) {
  ...
  rowHeightsPx.set(rowId, (points * 96) / 72);
  ...
  this.rowHeightsPx = rowHeightsPx;
```

`refreshPresentation` models each row's height once, in CSS pixels, and retains the map;
`updateSession` now reads `this.rowHeightsPx` instead of re-deriving heights from pagination
metrics. The session and the painted decorations read the *same* map, so the inspector can
never disagree with what is on screen. `paginateRows`, the page plan, and the break widgets are
simply gone — nothing needs them.

## pagination-plugin → presentation-plugin

```ts
// editor/presentation-plugin.ts — the surviving half of the old plugin
export function setBlockPresentation(
  transaction: Transaction,
  rowHeights: Record<string, number>,
  blockAligns: Record<string, string> = {},
  blockWidths: Record<string, string> = {},
  blockTypography: Record<string, string> = {}
): Transaction {
```

The decoration mechanics are unchanged (node decorations for align/typography/width, a
`taurus-row-start` min-height on each row's first block, transaction-meta updates outside undo
history) — the `PageBreak` widgets, `spaceBeforePixels`, and the `pages`/`pageLayout`
parameters are dropped. The line-spacing e2e test asserts against the same `min-height`
contract as before, and passes unmodified.

## Decision recorded: line spacing keeps persisting

The plan left one decision open in §6.B — whether `set_block_line_height` persistence stays.
It stays, as the plan recommended: the row-height model is independent of page fitting.
`setRowHeight` is untouched except that it now triggers `refreshPresentation`.

## Consequence: page geometry becomes read-only server truth

```ts
// session.ts
/** The document's canonical page geometry — read-only server truth. The stage
 *  renders it as the continuous paper's width and margins; nothing paginates
 *  against it and nothing in Alpha edits it. */
canonicalPageLayout: PageLayout;
```

With the geometry controls deleted, `setPageLayout` had no caller, so it left the contract
rather than survive as dead API. The canonical layout still flows in from Omega (including
other clients' `set_page_layout` ops) and draws the paper frame — one continuous sheet with
the canonical width and margins, the canonical page *height* kept only as an aesthetic minimum
so an empty document still reads as a page. `LayoutPanel` is now the "Document defaults" panel
(default typography only). If margin editing matters later, it is a deliberate re-add against
the real model, not a resurrection.

## Row-height math moves home

```
pagination/geometry.ts  →  systems/documents/layout.ts   (layoutPoint, standardRowHeight,
                                                          canonicalRowHeight)
```

`systems/documents/layout.ts` — formerly the print-string page-geometry vocabulary — is trimmed
to exactly the math line spacing needs, per the reorg's target layout. Its old contents
(`DocumentPageLayout`, `dimensionsForPageSize`, `calculateDocumentPages`, the canonical↔print
translators) had no remaining consumers. The module gained the prose companion it had always
been missing.

## Verification

`pnpm check` 0/0 · 284 unit tests · `pnpm build` clean · companions fresh · inspector e2e 5/5
against real Omega — including the run-line-spacing regression test, which exercises the new
presentation plugin end to end (optimistic paint + `set_block_line_height` persistence). The
only other e2e failure is the pre-existing `resources.spec.ts` Slides drift recorded in the
orientation doc; it fails identically before and after this change.
