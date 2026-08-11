# AlignmentControls.svelte

Horizontal and vertical alignment toggles for the block lenses (Block, Multiple Blocks).

Alignment is a **block** property, not an inline mark, which is why the text lenses do not
render this: aligning "the selected words" has no meaning in the document model.

## Optimistic local state, seeded from the block

```ts
let horizontal = $state<string>('left');
let vertical = $state<string>('top');
let alignFor = $state('');

$effect(() => {
  const align = blockIds[0] ? $editorSession?.blockAligns[blockIds[0]] : undefined;
  const key = `${blockIds.join(':')}:${align?.horizontalAlign ?? ''}:${align?.verticalAlign ?? ''}`;
  if (key !== alignFor) { /* re-seed */ }
});
```

The toggles are driven by local state rather than read straight from the store, so a click
shows its pressed state immediately without waiting for a round trip. The effect re-seeds them
whenever the target or its stored alignment changes — including when an optimistic edit is
superseded by server truth — while the key guard stops it from clobbering a just-clicked value
on unrelated re-renders.

`left`/`top` are the fallbacks because they match the editor's own block defaults, so an
unaligned block reads as left/top rather than as nothing selected.

## Writing one axis at a time

```ts
$editorSession?.actions.setBlockAlignment(blockIds, { horizontalAlign: value as HorizontalAlignment });
```

Each handler sends only its own axis, so setting horizontal alignment never overwrites a
vertical value the user set earlier — the action merges the patch. Both write to every block in
`blockIds`, which is how Multiple Blocks aligns a whole selection at once.

## The separator is real

```svelte
<div role="separator" aria-label="Horizontal and vertical alignment" aria-orientation="vertical" …>
```

The two groups are visually one strip, so the divider between them is given `role="separator"`
and a name rather than being a decorative `<div>` — otherwise the six buttons read as one
undifferentiated group.
