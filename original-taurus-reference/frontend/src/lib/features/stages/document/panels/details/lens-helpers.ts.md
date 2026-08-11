# lens-helpers.ts

Pure helpers shared by the Details inspector's lens components. Extracted when
`DetailsPanel.svelte` was decomposed (workstream A of the document-subsystem reorg): these are
the parts that would otherwise be copied into every lens. Nothing here reads `editorSession` —
a lens passes in what it already holds, which keeps the helpers trivially testable and keeps
the store dependency in the components.

## Narrowed selection slices

```ts
export type RunSelection = Extract<SelectionInfo, { mode: 'run' }>;
export type NewTextSelection = Extract<SelectionInfo, { mode: 'new-text' }>;
// … one per mode
```

`SelectionInfo` is a discriminated union; the orchestrator switches on `mode` once and hands
each lens its own variant. Typing the prop as the narrowed slice means a lens never re-checks
the mode and *cannot* reach for a field a different mode owns — the compiler enforces the
dispatch that used to be a convention inside one big `{#if}` chain.

## rowKeysOf / blockIdsOf — naming a control's target

```ts
export function rowKeysOf(blocks: InspectedBlock[]): string[] {
  return [...new Set(blocks.map((block) => block.rowId ?? `block:${block.blockId ?? block.pos}`))];
}
```

Row-scoped controls (line spacing) address rows; block-scoped controls (alignment, indent)
address block ids. Both derive from the lens's own blocks, which is the structural form of the
B1 fix: each lens names its target rather than a single panel-wide derive trying to cover every
mode. The `block:` fallback covers a freshly inserted block that has not round-tripped and so
has no row yet — it still seeds the control from `rowHeights`, though no op can target it.
`blockIdsOf` drops null ids for the same reason: only server-known blocks can carry an op.

A `run` selection is the exception and never goes through `rowKeysOf` — it has no
`InspectedBlock`s at all, so the runtime hands it `rowIds` directly (see `editor/session.ts`).

## selectionKey — when a draft should re-seed

```ts
export function selectionKey(selection: SelectionInfo): string {
  if (selection.mode === 'run') return `run:${selection.blockIds.join(':')}:${selection.text}`;
  // …
}
```

Two controls hold a local draft the user types into: the reference/link field and the prompt
instruction. They must adopt the new target's value when the selection moves, but must not
overwrite what is being typed on every unrelated re-render. Both compare this key against the
one they last seeded from and re-seed only on a change. The key includes the selected text for
a run and the caret for `new-text`, so moving within the same block still counts as a new
target.

## Formatting helpers

`wordCount` backs the facts lists and `blockKindName` labels a block's kind badge.
`blockKindShortName` (the one-or-two-character row-child badge) and the `BlocksSelection` /
`RowSelection` slices were deleted with `RowLens` and `BlocksLens` in workstream D — those
lenses were unreachable by design (UX1). `selectionKey` still handles the `blocks` / `row`
modes because they remain in the frozen `SelectionInfo` vocabulary.
