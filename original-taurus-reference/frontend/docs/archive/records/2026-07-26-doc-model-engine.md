# Doc-model Stage 1 — engine core (text + sub-kind, 7 kinds)

Adapts Alpha's document engine to Omega's block-model overhaul (records 0079–0082
+ the callout/fg-bg follow-ups). The shipped editor targeted the old 14-kind model
and broke against the migrated backend (headings collapsed to body; `set_block
heading_1` → 400). This makes load/save work again against the new model. It
**supersedes A2 Commit 1** (`7567abb`), which added callout/code/divider as distinct
kinds under the old model.

## The new model (frontend mirror)

- **Kinds** are now `text`, `code`, `callout`, `list`, `divider`, `image`, `prompt`.
  A `text` block carries a semantic **`subKind`** — a built-in (`body`,
  `heading_1..6`) or a custom style id. A block's `style` gains **`indent`**.
- **Inline typography marks** `font` (family/size), `fg`, `bg` join the mark set;
  `CustomTypography` carries `fg`/`bg` (the block-override cascade level).
- **`ChangeOp`** gains `set_block_subkind`, `set_block_indent`, the list ops
  (`set_block_data`/`set_list_type`/`set_list_item`), and `set_default_typography`.

## Engine

- **`block-kinds.ts`** (SSOT) — the 7 kinds + the built-in text sub-kinds (Body +
  Heading 1–6) with heading-level helpers (`headingLevel`, `subKindForLevel`).
  `textTypeOptions` = sub-kinds; `insertElementOptions` = code/callout/list/divider/prompt.
- **`schema.ts`** — the paragraph node carries `kind` (default `text`) + a `subKind`
  attr; a leaf `block_leaf` node round-trips the not-yet-editable list/image kinds;
  the `font`/`fg`/`bg` marks render as styled spans.
- **`bridge.ts`** — `blockNode` maps a heading sub-kind → the heading node, body/custom
  → the paragraph node, list/image → the placeholder; `nodeKind`/`nodeSubKind` invert
  it; the mark helpers carry the font/fg/bg attrs. The **diff distinguishes a kind
  change (`set_block`) from a text sub-kind change (`set_block_subkind`)**, and drops a
  data kind's stale payload only on a real kind change.
- **`runtime.ts`** — `setTextType(subKind)` converts the touched text blocks' sub-kind;
  `convertBlockAt` maps a sub-kind to a heading/paragraph node; the mark reads/writes
  and custom-typography drop-loop cover font/fg/bg; new blocks default to `text`.
- **`styles.ts`/`inspector.ts`** — typography convention is sub-kind-agnostic (heading
  sizing comes from the h1–h6 CSS); custom CSS emits `fg`→`color`, `bg`→`background-color`;
  the height-floor is keyed on the 7 kinds.
- **`DetailsPanel.svelte`** — the block-kind select becomes a **Text type** (sub-kind)
  select driving `setTextType`; the color control uses `fg`. **`LayoutPanel.svelte`** —
  the broken semantic body/heading typography selects are removed (Page + Margins stay).
  **`DocumentStage.svelte`** — the dead quote rule is dropped; callout/code/divider CSS
  stays; a `.block-leaf` rule renders the list/image placeholder.

## Deferred to later stages (tracked, not hidden)

- **Stage 2 — inline typography controls**: wire the font/size/fg/bg inspector controls
  as marks + custom fg/bg + the 5-level cascade render.
- **Stage 3 — inspector redesign**: Insert element (code/callout/divider/list/prompt) +
  **Indent** + line spacing + sub-kind-aware height floors.
- **Stage 4 — lists**: real list editing (marker type / items / nesting / check) — today
  a list round-trips as a read-only placeholder.
- **Stage 5 — Layout**: document default typography (`set_default_typography`).

## Verification

- `pnpm check` **0 errors**; `pnpm test` **252 passed**. The rewritten `bridge.test.ts`
  asserts the exact new behavior — body→heading emits `set_block_subkind` (not
  `set_block`), text→callout emits `set_block`, prompt→text drops the data, an fg mark
  round-trips with no spurious ops, and a list maps to the placeholder. `block-kinds.test.ts`
  covers the registry + heading-level helpers.
- **Contract-matched** to the Omega source (exact op field names: `setSubKind`, `indent`,
  `listData`/`setListType`/`listIndex`/`item`, mark `attrs.value`/`family`/`size`,
  `CustomTypography.fg/bg`).
- **Live browser E2E is pending** — no headless Chrome here; the stack is up on `:5173`
  for a click-test (type → Text-type → Heading → reload persists, exercising
  `set_block_subkind` against `:8443`). Tracked, not skipped.
- **Companions:** all 11 touched source files' `.md` regenerated + byte-verified OK.
