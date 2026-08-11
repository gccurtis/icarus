# 2026-07-27 — Persistent selection, a compact Style control, a tan preview, and no Next Text in code

A review pass on the document inspector, from the user's notes: the selection appeared to
vanish when clicking the panel; the Selected-Text preview and the Text-type dropdown read as
too white; New Block wanted a divider; and code blocks should not offer the inline-typography
lens. Colors go through a new token, not raw values.

## Selection stays visible while the inspector has focus

```ts
// editor/selection-highlight.ts — a plugin that paints the range while blurred.
export function selectionHighlightPlugin(): Plugin<boolean> { /* focus state + blurred decoration */ }
// runtime.ts plugins(host): history(), paginationPlugin(), selectionHighlightPlugin(), …
```

The browser drops the native `::selection` highlight when the editor blurs, so operating the
side panel looked like it discarded the selection even though ProseMirror still held the range.
A new plugin tracks focus (via `blur`/`focus` DOM handlers that dispatch a metadata-only
transaction) and, while blurred with a non-empty selection, decorates the range with a
`taurus-selection-hold` class styled to match the native selection.

**Why:** clicking a swatch or opening a select must not appear to lose the selection the action
applies to.

## The selection color is a token, and the preview box is tan

```css
/* app.css: one derived wash, defined per theme and mapped in @theme inline. */
--surface-selection: color-mix(in srgb, var(--role-focus) 22%, transparent);
--color-selection: var(--surface-selection);         /* used by ::selection + the hold decoration */
```

```svelte
<!-- DetailsPanel.svelte: the Selected-Text preview well is bg-panel (light tan), not bg-work. -->
<div class="mt-1.5 rounded-control border border-border bg-panel px-2 py-1.5">…</div>
```

`::selection` and the new hold decoration both reference `--color-selection` rather than
inlining a `color-mix`, and the preview box moves off near-white `bg-work` onto the tan
`bg-panel` surface. Documented in `docs/style/color-system.md`.

**Why:** raw colors should live in the token system; the preview reads better as a light-tan
well than as white.

## Text type becomes a compact "Style" row; New Block gains a divider

```svelte
<!-- textTypeAndSpacing: Line spacing first, then a compact inline Style select, then Indent. -->
<div class="flex items-center justify-between gap-3">
  <span class="text-caption text-secondary">Style</span>
  <Select value={subKind} aria-label="Style" options={textTypeOptions} size="sm" class="w-32" … />
</div>
<!-- New Block: a divider between Insert element and the typography controls. -->
{@render insertElementControl()}
<div class="border-t border-border pt-3">{@render typographyControls()}</div>
```

The stacked full-width "Text type" dropdown is now a compact inline "Style" row moved below Line
spacing, and New Block separates Insert element from Font with a divider.

**Why:** the big white dropdown dominated the panel; a compact labeled row is calmer.

## Code blocks inspect as a Block, not Next Text

```ts
// deriveSelection: only text-formatting kinds get the Next Text lens.
if (block.kind !== 'text' && block.kind !== 'callout') return this.blockSelection(block);
```

A caret in a `code` (or other non-text) block now resolves to its `block` lens instead of the
`new-text` inline-typography lens; `callout` keeps Next Text since it is a formatting-capable
text paragraph.

**Why:** inline font/size/color is meaningless inside a code block.

## Verified

`e2e/document-inspector.spec.ts` grows to four tests, all green against real Omega: the
Selected-Text layout, Backspace outdent, the selection-hold highlight appearing only when the
editor blurs with a range, and a code block inspecting as a Block with no Next Text. `pnpm
check` 0/0, 284 unit tests, all companions byte-exact.
