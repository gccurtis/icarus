# 2026-07-27 — Document inspector: FG/BG labels, Line spacing, Text type for text lenses

Refinements to the Details inspector's text lenses (Next Text / Selected Text), per the user's
review: rename the colour controls, tidy the Line spacing field, and surface a Text type control
when editing text.

## Colour controls read FG / BG

```svelte
<!-- DetailsPanel.svelte typographyControls + colorPopover -->
<button aria-label="FG color" …><span>FG</span>…</button>
<button aria-label="BG color" …><span>BG</span>…</button>
<!-- swatches: aria-label={`${target === 'fg' ? 'FG' : 'BG'} ${color}`}; "Clear fill" → "Clear BG" -->
```

**Why:** the foreground/background controls were labeled "Text" / "Fill"; the user wanted the
compact, conventional **FG** / **BG**. (This also aligns with the editor e2e's `FG color` /
`FG #…` expectations.)

## Line spacing drops the "px" suffix

```svelte
<!-- rowHeightControl NumberField: the suffix="px" was removed -->
<NumberField bind:value={rowHeight} ariaLabel="Line spacing" min={heightFloor} max={1200} step={8} class="w-20" onchange={changeHeight} />
```

**Why:** the trailing "px" crowded and clipped the number in the narrow field. Row height is an
integer pixel value, so the unit is unnecessary noise; removing it fixes the cutoff.

## Text type control in Next Text and Selected Text

```svelte
<!-- new-text (Next Text): a bottom section with Text type + Line spacing -->
<Select value={selection.block.subKind ?? 'body'} aria-label="Text type" options={textTypeOptions} … onchange={setTextType} />
{@render rowHeightControl(false)}
<!-- run (Selected Text): Text type, shown when the range starts in a text block -->
{#if selection.subKind !== undefined}<Select value={selection.subKind ?? 'body'} … />{/if}
```

To give Selected Text a value, the runtime's `run` selection now carries the start block's
`subKind` (resolved via `blockAt(from.before(1))`), and `SelectionInfo['run']` gains an optional
`subKind`. `setTextType` already applies across the whole selection.

**Why:** the user asked "where is the section that lets you change the text type?" — it existed
for New Block / Block but not while editing text. Next Text (caret) has a single block so it gets
both Text type and Line spacing; Selected Text can span blocks, so it gets Text type (reflecting
the first block, applied to the range).
