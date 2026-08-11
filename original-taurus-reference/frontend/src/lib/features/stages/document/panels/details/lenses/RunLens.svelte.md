# RunLens.svelte

**Selected Text** — the lens for a non-empty text range, which may span several blocks.

## A preview well with a fixed height

```svelte
<div class="mt-1.5 rounded-control border border-border bg-work px-2 py-1.5">
  <p class="line-clamp-3 min-h-[3lh] whitespace-pre-wrap text-body-sm text-primary">
    {selection.text}
  </p>
</div>
```

The selected text is echoed in a bordered well so it reads as a quoted artefact rather than as
panel copy. `min-h-[3lh]` and `line-clamp-3` pin it to exactly three lines whether the selection
is one word or a paragraph — the panel must not resize while the user drags a selection, and
truncation is preferable to a control layout that moves under the pointer.

## Order: inline, then block, then hand-off, then facts

```svelte
<TypographyControls typography={selection} selectionKey={selectionKey(selection)} />
{#if selection.subKind !== undefined}
  <TextTypeAndSpacing … />
{/if}
<AddCommentControl />
<Facts divided items={[…]} />
```

Inline typography first (it acts on exactly what is highlighted), then the block/row group, then
Add comment as the last action, then read-only facts. The facts sit *below* the comment button
deliberately: everything actionable stays together above the last divider.

`TextTypeAndSpacing` is conditional because `subKind` is only defined when the run starts in a
text block. A selection that begins in a code block or divider has no text type to change, and
offering one would imply a conversion that will not happen.

## Rows come from the runtime, blocks from the run

```svelte
rowKeys={selection.rowIds}
blockIds={selection.blockIds}
```

This is bug **B1** fixed structurally. A run is the only selection mode with no
`InspectedBlock`s, so it cannot derive its rows the way the other lenses do — the runtime
collects them during the walk that gathers `blockIds` and hands them over as `rowIds`. The old
panel-wide derive produced an empty list here, so Line spacing on selected text called
`setRowHeight([], …)` and silently did nothing.

Indent targets the blocks the run spans, so indenting a selection that crosses three paragraphs
indents all three.

## `Lines` counts blocks

`selection.blockIds.length` is the number of blocks touched, labelled *Lines* because that is
what the count means to someone looking at the document — a block is a line of content here,
and "Blocks" is reserved for the document-level count in the None lens.
