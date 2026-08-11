# NewTextLens.svelte

**Next Text** — a caret sitting in a non-empty text or callout block.

## Formatting the future, not the present

```svelte
<p class="text-caption font-medium text-secondary">Next Text</p>
<p class="mt-1 text-caption text-muted">Formatting applies to the text you type next.</p>
```

Nothing is selected, so the inline controls here do not modify existing content — they set the
*stored marks* for the next typed character. That is genuinely surprising behaviour, so the lens
says it in plain words rather than relying on the name. The `TypographyState` this lens
intersects is the caret's pending format, which is why the same `TypographyControls` component
serves both this and the run lens without knowing the difference.

## Block scope still applies to the current block

```svelte
const blocks = $derived([selection.block]);
…
rowKeys={rowKeysOf(blocks)}
blockIds={blockIdsOf(blocks)}
```

Line spacing, style, and indent are block properties, and the caret is *in* a block — so those
act on the block containing the caret, immediately, unlike the inline controls above them. The
single block is wrapped in an array so it can go through the same `rowKeysOf`/`blockIdsOf`
helpers every other lens uses.

## Which blocks get this lens

The runtime routes here only for `text` and `callout` blocks. Code blocks, dividers, and images
inspect as a Block instead: they hold no formattable inline text, so offering font and colour
controls would promise an edit that cannot happen. An *empty* text block routes to the New Block
lens instead, which adds Insert element.

There are no facts at the end — a caret has no character or word count of its own, and repeating
the block's counts would just be the Block lens with fewer controls.
