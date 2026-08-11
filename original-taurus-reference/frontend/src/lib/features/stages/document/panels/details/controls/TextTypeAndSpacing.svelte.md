# TextTypeAndSpacing.svelte

The grouped section the three text-bearing lenses share — Line spacing, Style, and Indent under
a single divider.

## A composition, not a control

```svelte
<div class="space-y-2 border-t border-border pt-3">
  <RowHeightControl {rowKeys} />
  <div class="flex items-center justify-between gap-3">
    <span class="text-caption text-secondary">Style</span>
    <TextTypeSelect value={subKind} />
  </div>
  <IndentControl {blockIds} />
</div>
```

This component holds no state and calls no action. It exists to group three block/row-scoped
controls that always travel together, so Selected Text, Next Text, and New Block cannot drift
apart in layout — the arrangement is stated once instead of three times.

The grouping is also the panel's structural boundary: everything above it in a text lens is
inline typography (range marks), everything in this section applies to the block or its row.

## Targets are passed through, not derived

```svelte
let { subKind, rowKeys, blockIds }: { subKind: string; rowKeys: string[]; blockIds: string[] } = $props();
```

Rows and blocks arrive from the lens rather than being derived here. Each lens knows its own
target: a run has `rowIds` from the runtime and the `blockIds` it spans, while `new-text` and
`new-block` resolve theirs from their single block. That is why this component can be shared —
it never has to ask which mode it is rendering inside.

`divided` is not forwarded to the children: the section owns the one divider, and the controls
inside it sit flush. The Block, Blocks, and Row lenses use the same controls *ungrouped*, each
with its own divider, which is why `RowHeightControl` and `IndentControl` keep that prop.
