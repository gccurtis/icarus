# A2 — block kinds, Insert-element & Text-type — design

_Date: 2026-07-25. Status: approved design (revised after review), pre-implementation._

## Context

Alpha's document editor exposes **8 of Omega's 14 block kinds** (paragraph,
heading 1–6, prompt). This is the **A2** slice of the alpha wire-up
([`../../integration/current/alpha-wireup-plan-2026-07-25.md`](../../integration/current/alpha-wireup-plan-2026-07-25.md)):
add the structural kinds the cockpit is missing and redesign the inspector around
two clear controls — **Insert element** and **Text type**. The block/style model and
product decisions behind it live in
[`../../architecture/document-block-and-style-model.md`](../../architecture/document-block-and-style-model.md).

Grounding facts verified in `taurus-omega/core/capability/document`:

- **14 kinds** (`model.go`). Text-bearing: paragraph, heading 1–6, quote, code,
  callout, list_item. No atoms: divider, image. Prompt is special (existing).
- **Typed data** (`changeset.go` `validBlockData`): `list_item` requires `ListData`;
  `image` requires `ImageData`; every other kind carries none (prompt: `PromptData`
  or nil).
- **Ops**: `insert_block` carries a whole `Block` (data included); `set_block`
  changes **kind only** (never data); there is **no** `set_block_data`.
- `set_block` between no-data kinds is safe: `normalizeBlock` doesn't clear stale
  data, but `Block.UnmarshalJSON` drops data that doesn't match the kind, so a kind
  change **self-heals on the next load**.
- **Markdown import** (`markdown_document.go`) produces paragraph / heading / **quote**
  blocks — so quote blocks *can* arrive even though A2 won't offer quote as a choice.

## Scope

**In this pass:** `code`, `callout`, `divider` + the inspector redesign (Insert
element; `new-block` carrying the **full next-text typography**; a new **Extra
formatting** section with **Text type** and **Line spacing**) + a **Layout panel
cleanup** (remove the semantic-typography defaults; real-font defaults are deferred).

**Deferred (each with a tracked reason):**

- **`quote`** — _not offered_ as a kind (the inline quote-wrap action already exists;
  per review, quote isn't a first-class kind). Kept **render-only** — an imported
  quote block styles as a blockquote — so markdown round-trips don't break.
- **`list`** — the cockpit wants a single **`list` element** with internal items,
  which needs a native Omega `list` kind that doesn't exist yet. Filed as gap **G5** /
  [`../../backend-requests/list-block.md`](../../backend-requests/list-block.md);
  built against the native kind when it ships.
- **Indent level** — a _general text-type_ control (all text blocks, not a list
  thing). No Omega block carries an indent today, so it's deferred with the same
  request (block `indent` field). Shown in the Extra-formatting design; hidden until
  the field lands.
- **`image`** — needs the Files upload flow; its `ImageData` type is added for model
  completeness but nothing renders/inserts it yet.
- **Layout real-font defaults + terminology** — a page default font and body/heading
  real typography aren't backable (custom fonts are per-block; no document/kind-level
  default). Filed as gap **G6** /
  [`../../backend-requests/typography-defaults.md`](../../backend-requests/typography-defaults.md).
  This pass **removes** the Layout panel's rejected semantic-token defaults (the
  registry stays internal, still driving default heading sizes); real controls return
  when the backend lands. The `paragraph`↔`body` naming (and a `text` kind with
  sub-kinds) is in the same request; the UI keeps "paragraph" for now.

## Goals

- Insert dividers, code blocks, and callouts, and convert lines to **Body /
  Heading 1–6** — all persisted via real Omega ops.
- The inspector presents **Insert element** (new line) and a collapsible **Extra
  formatting** section (**Text type** for inline text; **Line spacing**), replacing
  the old flat kind `Select` and the mocked line-spacing control.
- The block-kind model is a **single source of truth** (`block-kinds.ts`) the schema,
  bridge, inspector, and rendering all read from.
- Every new op round-trips against Omega; companions + a change record per commit;
  `pnpm check` + `vitest` green.

## Non-goals

- Lists, indent, image, and list-data mutation (all deferred above).
- Split-a-block-at-selection-bounds on a Text-type change — dropped as
  over-engineering; Text type is **whole-line** (Design §5).
- Offering `quote` as a user choice (render-only).

## Design

### 1. Taxonomy (the two user-facing controls)

| Control | Kinds | Op | Where |
| --- | --- | --- | --- |
| **Text type** (convert whole line[s]) | Body/paragraph, Heading 1–6 | `set_block` (no-data → clean) | Extra formatting, for a selection / a text line / a new line |
| **Insert element** (new block) | Divider, Code, Callout (+ Prompt; List & Image later) | `insert_block` | an empty new line |

Quote is neither offered nor inserted (render-only). List/image appear in neither
menu until their backend support lands.

### 2. Data model — `systems/documents/types.ts` + a kind registry

`types.ts` (mirrors Omega's JSON):

- `BlockKind` gains all six missing kinds (`quote | code | divider | callout |
  list_item | image`) — the full 14, so any kind Omega sends round-trips.
- `ImageData = { fileId: string; alt: string; width: number; height: number }` — added
  for completeness; unused until the image pass. (Flat `ListData` is intentionally
  **not** added — lists will use the native `list` kind's shape when it ships.)

New module **`systems/documents/block-kinds.ts`** — the single source of truth:

```ts
export type BlockKindGroup = 'text' | 'element' | 'other';
export type BlockKindMeta = {
  kind: BlockKind;
  label: string;            // "Code", "Callout", "Divider"…
  offered: boolean;         // shown in a menu (quote/list_item/image = false)
  group: BlockKindGroup;    // 'text' → Text-type; 'element' → Insert-element
  textBearing: boolean;     // holds atoms
  isLeaf: boolean;          // divider, image
  dataKind: boolean;        // prompt, list_item, image — carries typed Data
  icon: Component;          // lucide icon for the menus
};
export const blockKinds: Record<BlockKind, BlockKindMeta>;
export const textTypeOptions;      // Body, Heading 1–6 (group 'text' && offered)
export const insertElementOptions; // Divider, Code, Callout, Prompt (group 'element' && offered)
export const isDataKind = (k: BlockKind) => blockKinds[k].dataKind;
```

The inspector menus, schema↔kind mapping, bridge data/atom rules, and CSS class
hooks all derive from this map.

### 3. ProseMirror schema — `editor/schema.ts` (the hybrid)

Node type follows **content model**, not visual style:

- **Reuse the `paragraph` node** (distinguished by its existing `kind` attr, as
  `prompt` already is) for `callout` and `quote` — both `inline*` + marks. `toDOM`
  emits `['p', attrs, 0]` where `attrs` adds `data-kind` when the kind isn't
  `paragraph`, so CSS can style callouts and (render-only) quotes.
- **New `code_block` node** — `content: 'text*'`, `marks: ''`, `code: true`,
  `defining: true`, attrs `{ blockId, rowId, kind:'code' }`, `parseDOM: [{ tag:'pre',
  preserveWhitespace:'full' }]`, `toDOM: ['pre', ['code', 0]]`.
- **New `divider` node** — leaf (`atom: true`, `selectable: true`), attrs
  `{ blockId, rowId, kind:'divider' }`, `parseDOM: [{ tag:'hr' }]`, `toDOM: ['hr']`.

`image` and `list_item` get no node here (deferred); if one ever arrives it falls
through to a plain paragraph without data loss (the snapshot preserves its `data`).

### 4. Bridge — `editor/bridge.ts` (Omega ↔ ProseMirror)

- **`blockNode`** (Omega→PM): `heading_N`→heading; `code`→code_block (atoms as one
  text node); `divider`→divider (no content); else→paragraph node with `kind`
  (covers paragraph, prompt, callout, quote, and any deferred kind).
- **`nodeKind`** (PM→Omega): heading→`heading_N`; `code_block`→`code`;
  `divider`→`divider`; else→`node.attrs.kind`.
- **`diffDoc`**: new block → atoms `= []` for leaf kinds (divider); code carries
  atoms but no marks (its node has none). Existing block whose kind changed → **drop
  `data`** unless the new kind is a data kind (`isDataKind`), keeping the snapshot
  clean before the reload self-heal. Callout/quote are paragraph nodes, so the
  atom/mark reconciliation already covers them.

### 5. Runtime — `runtime.ts`

- **`setTextType(kind)`** (supersedes the inspector's `setBlockKind` use): convert
  **every block the current selection touches** to a Text-type kind (paragraph /
  heading_N) via `setNodeMarkup`. **Whole-line**, one `set_block` per touched block —
  no split-at-bounds. Handles caret-in-block (1), new line (1), and multi-line `run`
  (N) uniformly.
- **`insertElement(kind)`**: insert an element block at the current line — replace the
  current block if it's an empty paragraph, else insert after. Builds the PM node
  (divider leaf / empty code_block / empty callout paragraph); `blockId` starts null
  so the diff emits `insert_block`. Caret lands inside text-bearing elements.
- No list input-rules / list keymap / marker rendering this pass (they arrive with the
  native `list` kind).

### 6. Inspector — `panels/DetailsPanel.svelte`

Driven by `SelectionInfo.mode` and the kind registry:

- **`new-block`** (empty line): **Insert element** dropdown (top) → `insertElement`,
  then the **full next-text typography** (font family / size / color + marks) and the
  **Extra formatting** section — an empty line is a paragraph you're about to type
  into, so it formats like text. Insert element shows **only** here; the moment a
  character is typed the block becomes `new-text` (typography + Extra formatting, no
  Insert element) and is "formally that kind."
- **`run`** / **`new-text`** / a single text **`block`**: typography controls, then
  the collapsible **Extra formatting** section.
- **Extra formatting** (new, collapsible): **Text type** (Body / Heading 1–6 —
  _inline text kinds only_; hidden for elements) + **Line spacing** (the real
  row-height control). **Indent level** is designed into this section but **hidden**
  until the backend `indent` field lands (G5). This replaces the old top-level kind
  `Select` and deletes the mocked `LINE_SPACING_OPTIONS` control.
- **Element blocks** (code / callout / divider): their layout controls (alignment,
  line spacing) with no Text-type control.
- `kindOptions` is replaced by `textTypeOptions` / `insertElementOptions` from the
  registry.

### 7. Rendering — `DocumentStage.svelte` CSS

`:global` rules under `.doc-editor .ProseMirror`, keyed on `data-kind` / the new
nodes:

- `[data-kind="callout"]` — subtle background, border, rounded, padding.
- `[data-kind="quote"]` — left border, inset padding, muted italic (render-only, for
  imported blockquotes).
- `pre` (code_block) — mono, panel background, rounded, `white-space: pre`,
  `overflow-x: auto`.
- `hr` (divider) — a hairline rule with vertical rhythm; selected-node outline.

### 8. Layout panel — `panels/LayoutPanel.svelte`

Remove the **Body default** (paragraph typography) and **Heading styles** semantic
token `Select`s — the Goal-2.1 controls that surfaced the internal registry (which the
model keeps internal) and that review rejected. **Page** and **Margins** remain. The
internal semantic registry is untouched — it still drives default heading sizes via
`effectiveTypography` in rendering — so only its user-facing _editing_ is removed: the
now-unused write action `setBlockKindTypography` (and any other semantic write action
with no remaining caller, e.g. `setBlockTypography`) is deleted. The real controls
(page default font; body/heading real typography) return with the `typography-defaults`
backend work.

## Staging (three commits, each self-contained)

1. **Engine** — registry + schema (`code_block`, `divider`, paragraph `data-kind`) +
   bridge + rendering CSS (callout, code, divider, quote round-trip) + `setTextType` /
   `insertElement`. Verify `set_block`→heading and `insert_block` for
   divider/code/callout round-trip on Omega.
2. **Inspector** — the **Insert element** section, `new-block`'s full next-text
   typography, and the collapsible **Extra formatting** (Text type + Line spacing),
   wired to the commit-1 actions; remove the mocked line-spacing `Select`.
3. **Layout cleanup** — remove the Layout panel's semantic Body-default / Heading-styles
   selects (Page + Margins remain) and delete the now-unused semantic write actions;
   the internal registry read path stays for rendering.

Per commit: companions updated in the same change (byte-verify), `pnpm check` +
`vitest` green, change record in `docs/records/`, ops round-tripped on `:8444`
(these ops predate the verify binary — no rebuild) and, where engine-dependent,
`:8443`.

## Testing & verification

- **Unit (`vitest`)** — `bridge`: `omegaToPmDoc`→`diffDoc` round-trip per kind
  (heading convert → `set_block`; divider insert → block with **no atoms**; code
  insert → atoms + **no marks**; callout insert; kind change **drops stale data**;
  a quote block from a snapshot renders and round-trips). `block-kinds` registry shape.
- **Omega round-trip** — a script POSTs each op to `:8444` and re-reads the doc:
  `set_block`→heading; `insert_block` divider (no atoms) / code / callout all `201`
  and reload-stable.
- **Manual / Playwright** — Insert element → divider / code / callout; select three
  lines → Heading 1 converts all three; a code block rejects bold; Extra formatting
  collapses/expands; an imported `>` quote shows as a blockquote.

## File change map

| File | Change | Companion |
| --- | --- | --- |
| `systems/documents/types.ts` | `BlockKind` full 14; `ImageData` (unused) | update `.md` |
| `systems/documents/block-kinds.ts` | **new** registry (single source of truth) | update `.md` |
| `systems/documents/index.ts` | export `block-kinds` | update `.md` |
| `editor/schema.ts` | `code_block`, `divider` nodes; paragraph `data-kind` | update `.md` |
| `editor/bridge.ts` | kind↔node mapping; diff data/atom rules | update `.md` |
| `runtime.ts` | `setTextType`, `insertElement`; remove unused semantic write actions | update `.md` |
| `editor/session.ts` | `EditorActions`: +`setTextType`/`insertElement`, −semantic write actions | update `.md` |
| `panels/DetailsPanel.svelte` | Insert-element + Extra-formatting + `new-block` typography | update `.md` |
| `panels/LayoutPanel.svelte` | remove semantic typography sections | update `.md` |
| `DocumentStage.svelte` | kind CSS | update `.md` |

Docs (done): the `list-block.md` and `typography-defaults.md` backend requests, gaps
**G5** and **G6** with their README rows, and this spec. A change record per commit
follows during implementation.
