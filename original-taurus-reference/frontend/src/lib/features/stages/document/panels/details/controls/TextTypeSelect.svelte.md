# TextTypeSelect.svelte

The Body / Heading 1–6 picker, shared by the grouped "Style" row and the Block lens's header.

## One select, two labels

```svelte
let { value, ariaLabel = 'Style', class: className = 'w-32' }:
  { value: string; ariaLabel?: string; class?: string } = $props();
```

This existed twice in the old panel — once labelled *Style* inside the grouped section, once
labelled *Text type* in the Block lens header — with identical options and handler. Deduping it
required keeping both accessible names: they are what users of assistive tech and the e2e specs
address the controls by, and collapsing them to one name would be a silent behaviour change
made for the convenience of the refactor. The label is a prop; the behaviour is shared.

## No target prop

```svelte
onchange={(event: Event) =>
  $editorSession?.actions.setTextType((event.currentTarget as HTMLSelectElement).value)}
```

Unlike the other block-scoped controls, this one names no blocks. `setTextType` is defined as
whole-line: it converts *every* text block the current selection touches, emitting one
`set_block_subkind` per block. The action reads the live selection itself, so passing a target
would be redundant and could disagree with what the editor actually has selected.

The displayed `value` still comes from the lens, because what to *show* is per-lens: a run
shows its start block's sub-kind, a block lens shows its own.
