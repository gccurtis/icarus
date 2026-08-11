# RowHeightControl.svelte

The **Line spacing** field. Row-scoped: it writes a height to whole rows, not to blocks or to a
text range.

## The value is an increase in points, not a height

```ts
const standardHeightPt = $derived(
  $editorSession
    ? $editorSession.layoutRules.maxFontHeight + 2 * $editorSession.layoutRules.minRowPadding
    : 32
);
```

Omega models line spacing as `heightIncrease` — how much taller than the standard row a row
should be — and clamps it with `max(0, requested − standardRowHeight)`. Exposing an absolute
height meant every value below the standard (~32pt) silently collapsed to the same result, so
the control shows the increase directly: **0 is tight/default**, stepping by whole points up to
`layoutRules.maxHeightIncrease`. The bounds come from the document's own layout rules rather
than constants, so a document with different rules gets the right range.

The conversions (`* 72 / 96` in, `* 96 / 72` out) bridge the panel's points to the model's
pixels. `setRowHeight` takes pixels; the standard row height is defined in points.

## Seeding without fighting the user

```ts
$effect(() => {
  const modeledHeights = rowKeys.map((rowKey) => $editorSession?.rowHeights[rowKey]);
  const key = `${rowKeys.join(':')}:${modeledHeights.join(':')}`;
  if (key !== lineSpacingFor) { /* re-seed */ }
});
```

The key covers both the target rows and their modelled heights, so the field re-seeds when the
selection moves *and* when the height changes underneath it (an undo, a reload, another
client). Guarding on the key means the effect can run freely without overwriting a value mid-edit.

When several rows are selected the field shows the first row's spacing but writes to all of
them — an intentional simplification: there is no mixed-value state, and typing a value makes
the selection uniform.

## The target comes from the lens

```svelte
let { rowKeys, divided = false }: { rowKeys: string[]; divided?: boolean } = $props();
```

Taking the rows as a prop is the structural fix for bug **B1**. Previously one panel-wide
derive tried to compute row keys for every selection mode at once and produced an empty list
for a text run, so `setRowHeight([], …)` resolved no rows and did nothing. Now each lens names
the rows it means — and a lens that has no rows to offer simply does not render this control.
