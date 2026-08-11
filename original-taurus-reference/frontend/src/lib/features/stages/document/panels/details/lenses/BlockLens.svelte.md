# BlockLens.svelte

**Block** — one whole block, reached from the left-margin handle or by selecting a non-text
block such as code or a divider.

## Layout, not inline typography

A block selection has no text *range*, so there is nothing for the mark-based controls to apply
to; this lens offers alignment, line spacing, indent, and columns instead. That division —
inline marks for the text lenses, block properties here — is the main reason the inspector has
lenses at all.

## The header states the kind, or lets you change it

```svelte
{#if selection.block.kind === 'text'}
  <TextTypeSelect value={selection.block.subKind ?? 'body'} ariaLabel="Text type" />
{:else}
  <Badge tone="neutral">{blockKindName(selection.block)}</Badge>
{/if}
```

A text block can move between Body and Heading 1–6, so it gets the select. Every other kind
shows a read-only badge: converting a code block into a heading is not a text-type change, and
offering it in the same control would misrepresent what the picker does.

The select is labelled *Text type* here and *Style* inside the grouped section of the text
lenses. Both names were kept when the two were deduped — they are how the controls are addressed
by assistive tech and by the e2e specs.

## Kind-specific sections

```svelte
{#if selection.block.kind === 'prompt' && selection.block.blockId}
  <PromptControls blockId={selection.block.blockId} />
{/if}
{#if selection.block.kind === 'list'}
  <ListControls block={selection.block} />
{/if}
```

Prompt and list blocks carry data no other kind has. The prompt section additionally requires a
server id — its whole surface (instruction, resolve, evidence) is addressed by block id, so a
block that has not round-tripped yet has nothing to show rather than a section that cannot act.

## Shared controls, each named its own target

`rowKeysOf`/`blockIdsOf` over this lens's single block feed the row- and block-scoped controls.
`divided` is passed to line spacing and indent here — unlike in the text lenses, where
`TextTypeAndSpacing` groups them under one rule — because in this lens each control is its own
section.
