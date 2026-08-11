# 2026-07-27 — Inspector: real line spacing, a stable Selected-Text layout, and indent in the section

Two passes on the Details inspector's text lenses, per the user's review. First, the
"Line spacing" control was mislabeled row-height-in-pixels wired to the wrong numbers;
now it is Omega's real per-block height *increase* in points. Second, the Selected Text /
Next Text / New Block lenses were reordered for stability and grouped Text type, Line
spacing, and Indent into one section.

## Line spacing is the row's point increase, not a pixel height

```svelte
<!-- rowHeightControl NumberField: 0-based increase, step 1 -->
<NumberField bind:value={lineSpacing} ariaLabel="Line spacing" min={0} max={maxSpacing} step={1} … onchange={changeSpacing} />
```

`lineSpacing` is now the height increase above the standard row height, in whole points
(`0` = tight/default, up to `layoutRules.maxHeightIncrease`). `changeSpacing` converts it
back to a total pixel height for the existing `setRowHeight` action; the seed effect reads
a row's modeled pixel height and converts it to the increase. `standardHeightPt`/`maxSpacing`
derive from the document's `layoutRules`.

**Why:** the old control defaulted to `120px`, floored at `32px`, and stepped by `8`, but
Omega's model clamps `heightIncrease = max(0, requested − standard)` — so every value at or
below the standard silently did nothing ("doesn't work"), the default looked too wide, and
px↔pt rounding made the steps jump. Working in points fixes all three.

## Selected Text is a stable, bordered preview with facts at the bottom

```svelte
<div class="mt-1.5 rounded-control border border-border bg-work px-2 py-1.5">
  <p class="line-clamp-3 min-h-[3lh] whitespace-pre-wrap text-body-sm text-primary">{selection.text}</p>
</div>
…
{@render addCommentControl()}
<div class="border-t border-border pt-3">{@render facts([Characters, Words, Lines])}</div>
```

The selection renders in a bordered box with a fixed three-line height so the panel does not
jump as the selection changes. Add comment is the last control; the Characters / Words /
Lines facts sit beneath it under a divider (Lines = the blocks the selection spans).

**Why:** the panel shifted as content changed, and the user wanted the reference stats at the
stable bottom rather than mid-panel.

## Text type + Line spacing + Indent is one grouped section

```svelte
{#snippet textTypeAndSpacing(subKind: string, showIndent: boolean)}
  … Text type Select … {@render rowHeightControl(false)} {#if showIndent}{@render indentControl(false)}{/if}
{/snippet}
```

The grouped section sits under Reference in all three text lenses (Selected Text, Next Text,
New Block). Indent works for a run selection through a new `indentTargets` derived — a run's
blocks aren't in `inspectedBlocks`, so it resolves them from the run's `blockIds`.

**Why:** Text type had no home while editing text, and indent belonged beside it; a run
selection previously couldn't indent because its blocks never reached the indent action.
