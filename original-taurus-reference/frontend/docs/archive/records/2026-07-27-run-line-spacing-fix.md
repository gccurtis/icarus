# 2026-07-27 — Line spacing works on selected text (bug B1)

First commit of workstream **A** in the
[document-subsystem reorg](../plans/2026-07-27-document-subsystem-reorg.md). The bug is **B1**
in the [issues catalog](../plans/2026-07-27-document-subsystem-issues.md): the Details
inspector's *Line spacing* control did nothing at all when the selection was a text run
(the "Selected Text" lens). It landed before the decomposition so it stays small, reviewable,
and revertable on its own.

## The run selection now carries the rows it touches

```ts
// editor/session.ts — SelectionInfo['run']
      blockIds: string[];
      /** The distinct rows the selection touches, in document order — the target for
       *  row-scoped controls (line spacing). Every other lens can derive its rows from
       *  its `InspectedBlock`s; a run carries only block ids, so the runtime names them
       *  here. `setRowHeight` resolves these against the snapshot by row id. */
      rowIds: string[];
```

`setRowHeight` resolves each key it is given against the server snapshot **by row id**
(`runtime.ts`: `this.snapshot.find((r) => r.id === rowId)`), skipping anything it cannot
match. Every lens except `run` hands the panel `InspectedBlock`s, each carrying its own
`rowId`, so a row-scoped control can name its target. A `run` reported only `blockIds` — so
the panel had no way to name a row, derived an empty list, and called `setRowHeight([], …)`,
which iterates nothing and silently succeeds. Rather than have the panel reconstruct rows
from block ids (it has no map for that), the runtime states them.

This is an **additive** field on the otherwise-frozen `session.ts` contract. Frozen means the
shape does not churn while the runtime is split apart underneath it (workstream C); it does
not mean a bug that is only fixable in the contract goes unfixed. Nothing that ignores
`rowIds` is affected.

## The runtime collects rows in the walk it was already doing

```ts
    const blockIds: string[] = [];
    // The rows the run touches, collected in the same walk — row-scoped controls
    // (line spacing) need them and a run selection has no InspectedBlocks to ask.
    const rowIds: string[] = [];
    doc.forEach((node, offset) => {
      if (offset < sel.to && offset + node.nodeSize > sel.from) {
        const blockId = node.attrs.blockId as string | null;
        if (blockId) blockIds.push(blockId);
        const rowId = node.attrs.rowId as string | null;
        if (rowId && !rowIds.includes(rowId)) rowIds.push(rowId);
      }
    });
```

`deriveSelection`'s run branch already walked the document to collect block ids, so the rows
come for free — no second pass, no extra cost per transaction. Rows are de-duplicated and
kept in document order, which is what a multi-row selection needs.

## The panel asks the run for its rows

```svelte
  // Row targets for line spacing. A run selection has no `inspectedBlocks`, so it
  // names its rows directly (without this, Selected Text called setRowHeight([])).
  const inspectedRowKeys = $derived.by(() => {
    const selection = $editorSession?.selection;
    if (selection?.mode === 'run') return selection.rowIds;
    return [
      ...new Set(
        inspectedBlocks.map((block) => block.rowId ?? `block:${block.blockId ?? block.pos}`)
      )
    ];
  });
```

This mirrors the existing `indentTargets` derive, which already had to special-case `run` for
exactly the same reason — a run populates no `inspectedBlocks`, so anything block- or
row-scoped must ask the run directly. Workstream A's decomposition will turn this into each
lens naming its own target explicitly, which is the structural version of the same fix; doing
it here first keeps the two changes independently reviewable.

## A regression test that fails without the fix

```ts
test('Line spacing applies to a text run, not only to whole-block selections', async ({ page }) => {
  // …type, save, then select the whole line → the run lens…
  const lineSpacing = page.getByRole('textbox', { name: 'Line spacing' });
  await lineSpacing.fill('24');
  await lineSpacing.press('Enter');
  await expect.poll(minHeight).toBeGreaterThan(before);
});
```

The assertion reads the block's computed `min-height`, which is what the row-height decoration
actually sets — so it tests the effect on the document, not the control's own state. The old
code left the height untouched, so this test fails without the fix.

## Stabilised the selection-hold test

```ts
  for (let index = 0; index < 10; index += 1) await page.keyboard.press('Shift+ArrowRight');
  // Same settle as the other selection tests: under parallel load ProseMirror can lag the
  // native caret moves, and the panel would still be showing Next Text when we read it.
  await page.waitForTimeout(150);
```

This test failed once in a full-suite run and then passed 3/3 in isolation — a load-dependent
automation race, not a product bug: native key presses move the DOM caret, and under load
ProseMirror can lag in syncing that into its own selection state, so the panel still shows
*Next Text* when the assertion reads it. The other two selection tests already carried this
settle; this one did not.
