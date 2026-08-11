# Doc-model Stages 2+3 — inline typography + inspector redesign

Rebuilds the Details inspector on Omega's real typography + block model (records
0081/0082 + the fg/bg follow-up). The "real fonts" surface is now genuine and inline;
new lines get the full formatting affordances; blocks gain an indent control.

## Inline typography (font / fg / bg as marks)

- **`schema`** already had the `font`/`fg`/`bg` marks (Stage 1). The runtime now
  **reads** the active values (`inlineStyleFrom` over `markState`/`insertionMarkState`)
  and **writes** them via **`setInlineStyle(kind, attrs)`** — a `font` set merges
  family/size with any existing font mark; `fg`/`bg` carry a CSS color; a blank value
  clears. Over a selection it applies to the range; at a caret / on a new block it stores
  the mark for the next-typed text.
- **`DetailsPanel`** — the single "Color" popover splits into **Text** (fg) and **Fill**
  (bg); Font + Size drive `setInlineStyle('font', …)`. Values reflect the selection's
  active marks. This replaces the old per-block `set_block_custom_typography` path in the
  inspector (that action stays for a future block-level default).

## Inspector redesign

- **New Block** (an empty text line) now carries typography (via the split
  `SelectionInfo` + `insertionMarkState` seed) and offers **Insert element**
  (code/callout/divider/prompt) + **Text type** (sub-kind) + the full typography +
  indent.
- **Indent** — a 0–16 control on the inspected block(s) → **`setBlockIndent`**
  (`set_block_indent`), rendered as left padding (1.5em/level) in the block decoration.
- **Line spacing** is the real row-height control now (the mocked `LINE_SPACING_OPTIONS`
  dropdown is gone).
- A **Block** of a non-text kind shows its kind label instead of the Text-type select
  ("unless it's text, you can't change it").

## Deferred (later stages)

- **Stage 4 — lists**: real list editing (today a list round-trips as a placeholder).
- **Stage 5 — Layout**: document default typography (`set_default_typography`).
- Insert element's **list** option arrives with Stage 4; the full 5-level cascade
  *resolution* (inline > block > sub-kind > doc > built-in) renders naturally today via
  mark spans + the block decoration.

## Verification

- `pnpm check` **0 errors**; `pnpm test` **252 passed** (engine unit coverage unchanged;
  the inspector is component-level, exercised live).
- Op field names contract-matched to Omega (`set_block_indent {indent}`; the `font`/`fg`/`bg`
  mark attrs `family`/`size`/`value`).
- Live browser E2E pending (no headless Chrome; stack up on `:5173`).
- Companions: `session.ts.md`, `runtime.ts.md`, `DetailsPanel.svelte.md` regenerated +
  byte-verified.
