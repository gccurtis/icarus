# presentation.ts

The **PRESENTATION PASS** — one walk of the document producing everything the view needs to
render but that is not part of the editable content, plus the document-level projections the
session publishes.

## Why "one pass" is the point

There used to be two walks per transaction: `refreshPagination` built decorations while
`updateSession` rebuilt the session with overlapping per-block work (catalog **P-1**).
Workstream B collapsed them; workstream C gave the result a name and a home. The row-height map
computed here is retained by the runtime and published *as-is* in the session, so the
inspector's Line-spacing field and the painted `min-height` can never disagree — they are the
same numbers, not two derivations of the same rule.

## Row heights, computed separately on purpose

```ts
export function computeRowHeights(sources: PresentationSources): Map<string, number>
export function computeBlockDecorations(
  sources: PresentationSources,
  rowHeightsPx: Map<string, number>
): BlockPresentation
```

The split looks odd until you see the caller: the runtime computes row heights first, hashes
them into a signature, and **returns early** when nothing changed. Only on a real change does it
pay for the block decorations. Folding the two into one function would either lose that
short-circuit or hide it behind a flag.

Each row's height is `standardRowHeight(rules) + increase`, where the increase comes from
`overlay.rowHeightOf(rowId, serverIncrease)` — pending optimistic value over server truth —
converted from points to CSS pixels at the presentation boundary.

## The block decoration walk

One `doc.forEach` produces three maps keyed by block id:

- **alignment** — only when non-default, so unaligned blocks get no decoration at all;
- **typography** — the effective semantic typography (override → assigned style → kind default
  → convention), emitted *only when it differs from the kind's convention* so unstyled blocks
  keep their base CSS, with real-font custom typography layered on top and indent rendered as
  left padding (1.5em per level);
- **widths** — computed from the snapshot rather than the document, since column weights are a
  row property: a row with 2+ blocks splits its width by track weight (equal when untracked).

Every style read goes through `overlay.styleOf(blockId, serverStyle)`, so an optimistic
alignment or indent paints immediately (see [`overlay.ts`](overlay.ts)).

## The cascade resolvers

```ts
export function effectiveStyleRefOf(overlay, snapshot, blockId): BlockStyleRef | null
export function effectiveCustomOf(overlay, snapshot, blockId): CustomTypography | null
```

Free functions taking their inputs explicitly, rather than runtime methods reaching for `this`.
The runtime keeps two one-line private wrappers that bind them to its own overlay and snapshot —
the actions still call `this.effectiveCustom(blockId)` and read naturally.

## projectDocument — the document-level session data

```ts
export function projectDocument(doc: PmNode): SessionProjection
```

One walk yielding the heading `outline`, the ordered `rowKeys` (a `rowId`, or a synthetic
`block:<id>` key for a block that has not round-tripped yet), and the `blocks`/`words`/`chars`
counts. Pure — it takes only the document — which is why it can be read and reasoned about
without the runtime around it.
