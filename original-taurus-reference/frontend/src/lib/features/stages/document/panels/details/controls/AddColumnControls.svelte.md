# AddColumnControls.svelte

Insert an empty block beside the inspected one, to the left or right — how a single block
becomes a multi-column row.

## One reference block, a side

```ts
let { blockId }: { blockId: string | null } = $props();

function insertColumn(side: 'left' | 'right') {
  if (blockId) $editorSession?.actions.addColumn(blockId, side);
}
```

`addColumn` positions the new block relative to an existing one, so this control takes a single
reference rather than a list — "add a column" beside a multi-block selection has no single
answer. Only the Block lens renders it for that reason.

The prop is nullable because an `InspectedBlock` may not have a server id yet (freshly
inserted, not round-tripped). The guard makes that a no-op rather than an error: the buttons
stay visible and simply do nothing until the block exists in Omega, which is the same rule the
other block-scoped controls follow.

## Left/right icons, not text

`PanelLeftOpen` / `PanelRightOpen` show which side gains the column. Both carry a `title` and a
matching `aria-label`, since the icon alone does not convey "column" to a screen reader.
