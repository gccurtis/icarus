# overlay.ts

The **OptimisticOverlay** — every local edit that has been shown to the user but not yet
confirmed by Omega, plus the queue of ops that will confirm them. Second extraction of
workstream C, and the one that carries the fix for catalog item **B2**.

## The bug this module exists to remove

The runtime used to apply an optimistic alignment or indent by reaching into the server
snapshot and rewriting the block in place:

```ts
const block = this.findRowsBlock(this.snapshot, blockId);   // a LIVE snapshot block
block.style = { ...block.style, ...patch };                  // mutate it
this.pendingBlockAligns.set(blockId, { ...block.style });    // …and also record a copy
```

Two sources of truth for the same fact, kept in agreement by hand. The mutation was
*load-bearing* in a way nothing declared: `diffDoc` builds each next-snapshot block as
`{ ...previousBlock }`, so the optimistic style survived a flush only because the object being
spread was the very object that had been mutated. A defensive copy introduced anywhere in that
chain — in the differ, in the loader, in a future refactor — would have silently reverted
alignment and indent with no error and no failing test.

## The replacement: a layer, never a mutation

```ts
patchBlockStyle(blockId: string, base: Block['style'], patch: Partial<Block['style']>) {
  this.blockStyles.set(blockId, { ...base, ...patch });
}

styleOf(blockId: string, serverStyle: Block['style'] | undefined): Block['style'] | undefined {
  return this.blockStyles.get(blockId) ?? serverStyle;
}
```

The overlay owns the patch; readers resolve `overlay ?? snapshot`; the snapshot is never
written. `base` is the block's *effective* style rather than its server style, so a second
patch layers over the first — the behaviour the in-place mutation got for free.

## Folding into a new snapshot — the step that used to be an accident

```ts
applyTo(rows: Row[]): Row[] {
  if (this.blockStyles.size === 0) return rows;
  return rows.map((row) => ({
    ...row,
    blocks: row.blocks.map((block) => {
      const style = this.blockStyles.get(block.id);
      return style ? { ...block, style } : block;
    })
  }));
}
```

When a flush adopts the differ's `nextRows`, those blocks carry the *previous* style forward,
so the overlay must be folded in explicitly or the new snapshot would revert the optimistic
edit. `flush` now does `this.snapshot = this.overlay.applyTo(nextRows)` — one visible line
standing in for an invariant that used to be invisible. It returns fresh objects and leaves its
input untouched, so no aliasing is reintroduced.

Row heights are deliberately **not** folded: Omega models line height per block, while
`rowHeights` here is a presentation-only model whose server truth arrives on the next reload.

## The direct-op queue, and why `pendingOps()` copies

```ts
pendingOps(): ChangeOp[] { return [...this.ops]; }
settle(sent: ChangeOp[]) { this.ops = this.ops.filter((op) => !sent.includes(op)); }
```

`replace(match, op)` keeps one op per target (last write wins), which is how repeated
alignment clicks collapse to a single change. `pendingOps()` hands back a **copy** because
`settle` removes by reference equality: an action firing while an append is in flight pushes
onto the live queue, and if the sent list aliased that array the new, never-sent op would be
stripped. Both behaviours are pinned in `overlay.test.ts`.

These "extras" are sent **ahead of** the differ's ops — a style definition must exist before
the op referencing it, and block ops must land before content edits that could re-key a block.
That ordering was implicit; `flush` now states it (catalog **B3**).
