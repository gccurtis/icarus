# NewBlockLens.svelte

**New Block** — an empty text block, the state a fresh document opens in and the state left
behind by pressing Enter.

## The one lens that can change what a line *is*

```svelte
<InsertElementControl />
<div class="border-t border-border pt-3">
  <TypographyControls typography={selection} selectionKey={selectionKey(selection)} />
</div>
```

Insert element leads, because on an empty line the most likely intent is "make this something"
— a divider, a code block, a callout, a list, a prompt. It is offered here and nowhere else:
`insertElement` replaces the current line when empty and inserts after it otherwise, so on a
line with content the action would be ambiguous.

The divider between Insert element and the typography controls is carried by this lens rather
than by `TypographyControls`, because it separates two *kinds* of decision — what this block
becomes versus how its text will look — and only this lens has both.

## Otherwise it is the Next Text lens

An empty text block still carries the caret's pending format, so the same typography controls
apply to whatever gets typed, and the same block-scoped group (line spacing, style, indent)
applies to the block itself. The runtime distinguishes the two modes solely by whether the block
is empty; the extra control is the only difference the user sees.

Facts are omitted for the same reason as Next Text: an empty block has nothing to count.
