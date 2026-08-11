# presentation-plugin.ts

The ProseMirror plugin that renders the runtime's **block presentation** as decorations. It is
the surviving half of the old `pagination-plugin.ts` (workstream B of the document-subsystem
reorg): page breaks, sheet math, and the whole `PagePlan` vocabulary are gone — the document is
one continuous flow — but the per-block styling the pagination pass used to carry along is real,
user-visible presentation and stays.

## What it decorates

```ts
type BlockPresentation = {
  rowHeights: Record<string, number>;      // rowId → CSS px min-height (line spacing)
  blockAligns: Record<string, string>;     // blockId → non-default horizontal alignment
  blockWidths: Record<string, string>;     // blockId → column width % (multi-block rows)
  blockTypography: Record<string, string>; // blockId → typography + indent CSS fragment
};
```

Four maps, all computed by the runtime's single presentation pass (`refreshPresentation`) from
server truth overlaid with optimistic pending edits. Alignment, typography, and column width are
node decorations on the block; the row min-height (line spacing) lands on each row's **first**
block only, with the `taurus-row-start` class — the same contract the line-spacing e2e test
asserts against.

## Why decorations and not schema attrs

These values are *derived* presentation — server style + pending optimistic ops — not document
content. Keeping them out of the PM document means dispatching a presentation update never
touches the undo history or the differ: `setBlockPresentation` stores the maps as transaction
meta, and the plugin rebuilds its `DecorationSet` from them (or on any `docChanged`, so
decorations track positions as text is edited).

```ts
export function setBlockPresentation(
  transaction: Transaction,
  rowHeights: Record<string, number>,
  blockAligns: Record<string, string> = {},
  ...
```

The runtime tags these transactions `taurus:sync` + `addToHistory: false`, so they neither loop
back into the flush machinery nor pollute undo.

## What was deliberately dropped

`PageBreak` widgets, `spaceBeforePixels`, the `pages`/`pageLayout`/`pageGapPixels` parameters,
and the `taurus-page-break` DOM element. If page-fitting ever returns it is a new deliberate
project (see reorg §7), not a resurrection of this plugin.
