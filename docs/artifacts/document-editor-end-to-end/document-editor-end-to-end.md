# The Document Editor, End to End

Published at https://claude.ai/code/artifact/c5fe6446-0706-4a84-bbd7-a893893a5d8f

One document, three copies. The store holds the canonical one. The client holds a
live one and every change is an operation on it. The editor is a picture of the
live one and a way to ask for changes — nothing more. This is how the whole thing
works when it is finished.

Three colours run through every diagram on the page: **model** (the document as
data, and the canonical copy in the store), **live** (the client runtime's copy,
moved by ops), **editor** (ProseMirror, a projection of the live copy).

## 01 · Three copies of one document

The canonical document is a row in `documentSnapshots` with `role: "leader"`. The
client runtime holds a copy of it, and every change — from a panel, from the
editor, from undo — is stated as operations applied to that copy first and sent to
the store afterwards. The editor draws whatever the live copy currently is.

```
STORE  ←── change set (ops, baseRevision) ──  RUNTIME  ── re-project (body → doc) ──→  EDITOR
       ── accepted · stale (revision) ──→             ←╌╌ typing · selection ╌╌╌╌╌╌  (dashed: editor first, then ops)
                                               ↑ runtime.apply(ops)
                                             PANELS  ←╌╌ selection, as an address ╌╌ EDITOR
```

The one dashed arrow is the one exception: a keystroke lands in the editor first
so the letter appears without waiting, and is translated into an op immediately
afterwards. Nothing else goes through the editor to get to the document.

> The editor is an interface to the document, not a place the document lives. A
> panel that makes text bold applies a mark op to the live body; the runtime
> moves; the editor is re-projected and the text is bold because the body says so.
> Undo is the same path with the op inverted. Sync is the same path with the
> store's body in place of the live one.

Three consequences: the live copy advances the moment an op is applied;
re-projection leaves the selection where it was; every address in the document is
structural, not positional.

## 02 · The shape of a document

```
DocumentBody
├─ pageSetup?  PageSetup { paper: "letter" | … | { width, height }, orientation, margins { top, right, bottom, left } }
├─ styles?     StyleSet  { styles: Record<key, TextStyle>, defaultKey }
├─ header? · footer?  PageFurniture { rows[], firstPageRows?[], distanceFromEdge, pageNumber? { position, format?, startAt?, hideOnFirstPage? } }
└─ rows[]
   ├─ blocks row   { id "#rtitle", kind "blocks", blocks[], proportions?[] }
   │   └─ TextBlock { id "#btitle", type "text", variant "heading", level 1, style "heading-1", format?, atoms[], display, marks[] }
   ├─ divider row  { id, kind "divider", color?, width?, style? }
   └─ page break   { id, kind "pageBreak" }   — the one page boundary that is stored
```

`ContentBlock` is the one content primitive, shared with slides, comments and
messages: `text` (drawn and edited), `formula` (drawn read-only; expression in the
inspector), `image` (an atom node), `table` (drawn; cell editing out of this round),
`prompt` (text editable in place, state on the block).

Nothing in a document is addressed by its position.

## 03 · A text block, opened up

A text block holds **atoms** — literal (typed characters) or formula (a `{{ }}`
span that resolves to a string). **Display** is every atom's rendered text
concatenated. **Marks** are ranges over that text carrying formatting, a link, or a
colour.

```
atoms     #a1 literal "Peak demand … record by "   #a2 formula {{ forecast.delta }} → "four percent"   #a3 literal ", and two …"
display   Peak demand on the western interconnect is forecast to exceed last winter's record by four percent, and two …
marks     #m1 bold · from (#a2, 0) · to (#a2, 12)
```

**Where a mark points.** Each end names an atom and an offset into that atom's
*rendered* text. Display-space where it matters — twelve characters of "four
percent", not nineteen of `forecast.delta`. Structural where it matters — when the
formula re-resolves to "4.1 percent", `#m1` stays on `(#a2, 0)–(#a2, 11)`, clamped
to the new length; a display offset of 57–69 would now point at "4.1 percent," and
the comma. A mark moves only when its own atom is edited, and the applier does that
shifting.

**Model change (proposed).** `Mark.from` and `Mark.to` become
`{ atom: string; offset: number }`. `AnchorWithin.text` takes the same endpoints.
The selection already works this way — `signalOf` hands the inspector
`blockId/atoms/atomId@offset` today.

Marks are a list with ids; overlapping marks are legal; the id is what lets two
people format one paragraph without colliding.

| Field | Says | Values |
| --- | --- | --- |
| `variant` | What kind of block this is. The Sections outline reads it. | `paragraph · heading · list · quote · code` |
| `level` | Heading depth. | 1, 2, 3 … |
| `listStyle` | Which kind of list. | `bullet · ordered · todo` |
| `style` | Which named style — a key into the body's style set. Heading 1 is a style; heading is the variant it pairs with. | a key |
| `format` | This block's own overrides. Alignment lives here; spacing joins it. | `BlockFormat` |

## 04 · Styles, and what a block adds on top

A style is a named set of formatting held in the body's `StyleSet`; a block names
one by key. What is drawn is the style, then the block's `format` laid over it,
resolved per field — a block with no format draws exactly as its style.

**Two places to change spacing, on purpose.** Select text and change *After* in
the inspector: that writes the block's format and only that block moves. Select
the *Body* style and change *After* in the named-style lens: that writes the style
and every Body block moves.

**Model change (proposed).** `BlockFormat` gains `spaceBefore`, `spaceAfter`,
`lineHeight`, `indent`, optional, in the style's units.

**The default set** — Body, Heading 1, Heading 2, Heading 3, Quote, Caption, Code;
`defaultKey: "body"`, written the first time anything is styled, never on open.
Picking Heading 1 writes `style: "heading-1"` and `variant: "heading", level: 1`
together.

## 05 · Pages: setup and furniture

`PageSetup` is paper, orientation and four margins, in inches. Paper is a named
size or `{ width, height }`. Nothing about a page is drawn on the page — no guide,
no ruler.

**Header and footer** are each a `PageFurniture`: their own rows, an optional
first-page set, a distance from the edge, an optional page-number setting. One
definition, drawn on every page: each root has one canonical editor; repeated
appearances are read-only projections that focus it. Every furniture op names its
root — `header/rows`, `header/firstPageRows`, `footer/rows`. Page numbers are
generated from `pageNumber`, never typed.

**Pagination is derived** from paper, margins, rows in order, and the size each
block draws at; computed on the client on every change; never written. The only
stored boundary is an explicit page break row. The estimate is per block from the
resolved style — a bigger heading gets a smaller character budget and more height.

## 06 · The live document

`DocumentRuntime`, one per open document, holds: `body` (the live `DocumentBody`),
`revision`, `buffer` (ops applied and not yet flushed, coalesced before sending),
`undoStack · redoStack` (groups of ops), `sync`
(`loading · saved · saving · rebasing · needs-review · offline · error`), and the
mounted `editor` while the surface is on screen.

**Apply: the body moves first.** `apply(ops)` runs the applier over the live body,
then records for undo and buffers. Refusal applies nothing and buffers nothing.
The applier is one function in `representation/data/behavior/documents/`, run by
the client runtime and by `submit-document-changes` alike — the slide deck already
works this way.

**Flush: a change set at a time.** Buffer → `{ baseRevision, ops: coalesce(buffer),
touched }` → accepted (new revision, `saved`; when others landed underneath on
paths this set does not touch, their ops come back as catch-up and are applied to
the live body) or stale (rebase: revision updated, refused ops back to the head of
the buffer, `rebasing`, one retry) or unresolved (re-read the leader,
`needs-review`). A settled runtime is a reader and only a
reader takes the store's word for the body.

## 07 · Every change is an op

| Target · op | Path | Means |
| --- | --- | --- |
| `row` · insert · remove | `rows` · `header/rows` · `footer/firstPageRows` … | Whole rows by id; the root is in the path. |
| `row` · move | `rows` … | One row to after another; carries `wasAfter`. |
| `row` · set | `<rowId>/proportions` | How a blocks row divides its width. |
| `block` · insert · remove | `<rowId>/blocks` | Whole blocks by id within a row. |
| `block` · set | `<blockId>/variant · /level · /listStyle · /style · /format` | What a block is and how it draws. |
| `atom` · text | `<blockId>/atoms/<atomId>` | A splice; the applier shifts mark endpoints on that atom past `at`. |
| `atom` · insert · remove | `<blockId>/atoms` | A formula atom placed in prose, or taken out. |
| `mark` · insert · remove | `<blockId>/marks` | A whole mark by id. |
| `mark` · set | `<markId>/style · /link · /color · /from · /to` | One field of one mark. |
| `document` · set (new target) | `pageSetup` · `pageSetup/margins/top` · `header/distanceFromEdge` · `footer/pageNumber` · `styles/defaultKey` · `styles/<key>/fontSize` … | Anything above the rows. |
| `document` · insert · remove | `styles` | A named style by key; `after` ignored. |

Every op carries enough to be inverted without a lookup.

**Where ops come from.** A panel reads the selection and the live body and states
its ops directly. The editor derives ops by reading its doc back into a body and
diffing — the typing path only. Undo inverts the last group. The store never sends
ops; it sends bodies.

## 08 · Undo

⌘Z pops the last group, inverts each op in reverse, applies the inversion to the
live body, pushes the original to redo, buffers the inversion, re-projects. No
ProseMirror history. A typing burst is one group, on the coalescer's rule.

## 09 · Rendering: from body to page

| Model | ProseMirror node · attrs | Note |
| --- | --- | --- |
| `DocumentBody.rows` | `doc › page* › row*` | `page` is computed; no id. |
| blocks row | `blocks_row { rowId, proportions }` | |
| divider row | `divider { rowId }` | Atom node. |
| page break row | `page_break { rowId }` | Atom node; the packer closes the page after it. |
| `TextBlock` | `text_block { blockId, variant, level, styleKey, format, share }` | `toDOM` picks `h1…h4 · p · blockquote · pre`, stamps `data-style`. |
| literal atom | `text` nodes | Position → atom by walking the block's atoms in order. |
| formula atom | `formula_atom { atomId, expression, resolved, state }` | Inline atom node; the caret steps over it. |
| `Mark` | `bold · italic · underline · strike · code · link · colour { markId }` | One PM mark type per style, each carrying the model mark's id. |
| header · footer | a second and third `doc` | Separate roots and views. |
| `StyleSet` | one generated `<style>` | Keyed on `data-style`. |

**Re-projection keeps the selection**: addresses read before, resolved after; a
vanished block collapses to the nearest surviving position.

**Typing is the exception, and contained**: keystroke → PM → doc read back into a
body → diff → one text op → runtime; the bodies now match, no re-projection. Enter
and Backspace at a boundary become a row insert and remove by the same diff.

**The pasteboard**: zoom is view state per tab; the trailing gutter reserves a
lane for comment icons and only the leading gutter gives way.

## 10 · Selection

One or more ranges, each end `blockId/atoms/atomId@offset` — the same address a
mark or a comment uses.

| The caret is | Lens |
| --- | --- |
| a range, or several | `document-editor.text-selection` |
| in a block with characters either side | `document-editor.next-letter` |
| in a block with no characters | `document-editor.empty-line` (renamed) — Block: Text · Table · Image · Page break; as Text, everything the text lens has |
| on a table, an image, a formula block | `document-editor.table · image · formula` — the block's own fields; image is a new key; prompt and chart stay placeholders |

**Several ranges at once.** Non-contiguous. A custom ProseMirror `Selection`
subclass with a primary range and others; a plugin decorates the others; the lens
applies each op once per range.

**Model change (proposed).** `Selection` gains
`ranges?: readonly { id: string; at: string }[]`. The key
`document-editor.empty-block` becomes `document-editor.empty-line`.

## 11 · Four changes, traced

**Press B on a selection** — inspector reads `#bbody1/atoms/#abody1@0`–`@39`,
builds one op → runtime `apply([insert mark #m7 …])`, body moves, undo pushed,
buffered → editor re-projects the block, selection restored → store: one change
set, accepted.

**Type "s"** — PM inserts the character → editor reads its doc back, diffs: one
`text` op `at: 86, insert: "s"` → runtime `apply`, applier splices and shifts
mark endpoints on that atom; bodies match, no re-projection → store: coalesced,
flushed.

**Change the top margin** — Layout panel: `set document pageSetup/margins/top` →
runtime `apply` → editor recomputes metrics, repacks pages, re-projects, caret
stays in its word → store: flushed.

**Comment on a selection** — inspector: `create commentThreads { target, within,
quote }` then `create comments { threadId, blocks, author }` via the store → rows
written, body untouched → editor re-reads anchors: tint plus gutter icon →
inspector opens `general.comment`.

## 12 · The panels

The rail: Sections, Find, Styles, Layout, Comments, and placeholders Variables,
Templates, Prompts. A document opens on Sections.

**Content surface** — header and footer drawn from their furniture, page number
generated, formula atoms tinted and stepping as one unit, comment icons in the
gutter lane outside the paper (dim at rest, lit with the pointer in their anchor,
filled when open). Nothing on the page that is not in the document.

**Sections** — heading variants nested by level; each row carries line and page,
line first; filter over the list.

**Find** — one control switches Find to Replace; Replace brings its field and two
buttons; below, the hit count and hits with line, page and block.

**Styles** — New style, Duplicate, Rename above the search; a row per style with
typography shorthand and Apply; selecting a row opens the named-style lens.

**Layout** — paper (with Custom: width and height), orientation, four margins,
header (distance from edge, first-page differs, Edit header), footer (same), page
numbers (position, start at, hidden on first); Dimensions derived and read-only.

**Comments** — every open thread as the panel's quote block, attribution beneath;
selecting one scrolls the page to its anchor and lights it.

**Text selection** — quote; Style (style key, family, size, marks, horizontal
alignment as an icon row, FG/BG); Spacing (before, after, line height, indent);
Comments; Links. Across ranges, disagreeing controls draw mixed.

**Empty line** — Block (Text · Table · Image · Page break), then everything the
text lens has as Text. Next letter is this panel with a quote and stored marks.

**Named style** — usage count first; identity with Duplicate and Delete; typography
with alignment; spacing (before, after, line height, indent) for every block using
it.

**Table · Image** — the block's own fields as block ops. Prompt and chart are
placeholders.

**Comment thread** — the anchor as a quote block with who and when beneath; Reply
and Resolve above the thread; then the thread as quote blocks, attribution beneath.

Nothing selected draws nothing.

## 13 · Comments

A comment is about the document and not in it: rows in `commentThreads` and
`comments`, read and written through the generic store. Anchor
`{ kind: "text", blockId, from: { atom, offset }, to: { atom, offset } }`.

| State | Icon in the lane | Text |
| --- | --- | --- |
| At rest | Transparent, still occupying its row | No highlight |
| Pointer over anchored text | Opaque, every thread the text belongs to | Faint tint |
| Caret inside, or selection overlapping | Opaque, same set | Faint tint |
| Pointer over the icon | Opaque | Its own anchor tints |
| Thread open in the inspector | Filled | Strong tint |

The lane is the reserved trailing gutter; icons sit at their anchor's line and
stack on collision. Detached threads show with their quote. Resolving keeps the row.

## 14 · What this asks of the model

| Change | Where | Why |
| --- | --- | --- |
| `Mark.from`, `Mark.to` → `{ atom, offset }` | `content/content-block.ts` | Structural addresses. |
| `AnchorWithin.text` same endpoints | comment anchor | One address for selection, marks, comments. |
| `BlockFormat` + spacing fields | `content/block-format.ts` | A block can override its style's spacing. |
| `DocumentOp` + `document` target | `documents/op.ts` | Page setup, furniture, style set addressable. |
| `Selection` + `ranges?` | `workspace/tab.ts` | Non-contiguous selection. |
| `empty-block` → `empty-line`; `image` lens key; `templates`, `prompts` context keys | views vocabulary | A line with nothing on it, which can become a page break; the panels' vocabulary. |

Already there and merely unused: custom paper; `listStyle`; `PageFurniture` and
`PageNumbering`; the comment tables and anchor; the runtime's undo stack and
`invertAll`.
