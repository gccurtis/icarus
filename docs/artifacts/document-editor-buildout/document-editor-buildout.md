# Document Editor Buildout

Published at https://claude.ai/code/artifact/86a5a41d-1b83-4097-a77c-ee2ce064d9c3

What stands between the editor as it runs today and *The Document Editor, End to
End*, and the order to close it in. The companion page says how it works; this one
says what is missing.

Read against `work/semantic-overlay-cutover`. Built today: 2 of 12 panels, 0 of 6
model changes, 0 of 9 op targets beyond text and structure.

## 01 · Where it stands

A document opens, paginates, splits and merges rows, emits granular text ops, and
says Saved. Selecting text opens the Text selection lens with a real quote and a
real count. Everything below that quote is a mock, and says so.

| Piece | State | What is true |
| --- | --- | --- |
| Page surface | real | Pasteboard, paper, margins as percentages, zoom 50–200 with ⌘-wheel, gutter that collapses before the page does. |
| Text editing | real | Typing, split, merge, id stamping, repagination, caret preserved across relayout. Undo is ProseMirror's. |
| Persistence | real | `bodyOf` → `translate` → change set → store, with coalescing, rebase and undrawn-row preservation. |
| Selection signalling | real | `signalOf` routes to the three lens keys with a `blockId/atoms/atomId@offset` address — already structural. |
| Marks, style, font, size, colour | mock | Local state in the lens. Nothing to write to: the editor's schema has no marks and the block node has no attributes. |
| Comments and links | mock | Invented rows inside the lens file. Real threads sit in the store, unread. |
| Layout panel | read-only | Reads `DEFAULT_PAGE_SETUP`, not the document. Nothing is editable. |
| Runtime body | not live | Advances only when the store answers. Invisible today because ProseMirror holds the optimistic text; fatal the moment a panel edits anything. |
| Sections · Find · Styles · Comments · Variables · Templates · Prompts | absent | Keys route; files do not exist; the shell draws its placeholder. |
| Empty line · Next letter · Named style · Table · Image · Comment thread | absent | Same. The empty-block key fires on every empty paragraph and lands on a placeholder. |
| Header · footer · page numbers | absent | Typed; drawn nowhere. |

## 02 · Two schemas, and the gap between them

The word *schema* names two different things here. The **model** is `TextBlock` in
the representation: the document as data. The **editor's schema** is
ProseMirror's, in `procedures/schema.ts`: what the editor is able to draw. Today
the second holds almost none of the first.

| `TextBlock` · the model | `text_block` · the editor's node |
| --- | --- |
| `id · type "text"` | `blockId · atomId · share` |
| `variant · level · listStyle · checked · language` | — missing |
| `style` — key into the body's StyleSet | — missing |
| `atoms[]` — literal or formula | one literal atom only; a formula atom makes the block undrawable |
| `display` | text content = display |
| `marks[]` — `{ id, from, to, style?, link?, color? }` | `marks: {}` — no mark types at all |
| `format?` — BlockFormat | — missing |

Because the editor's node carries none of it, nothing can be drawn bold and nothing
can be read back bold: `bodyOf` rebuilds a block from the node and has to copy the
old marks through blind. The projection is lossy in both directions, and the lens
has nothing to write to.

**Four more, downstream of that one:**

| Where | Today | Has to become |
| --- | --- | --- |
| `procedures/translate.ts` | Diffs two bodies and emits text splices, block and row insert/remove/move, and a set on row proportions. | Emits mark, block-field, atom and document ops. Or, for panel edits, is not involved at all — a panel states its ops directly. |
| `capabilities/document/…/apply-ops.ts` | Accepts exactly the shapes translate emits. `set` handles one path and refuses the rest. | One applier in `representation/data/behavior/documents/` handling every target, wrapped by the capability and called by the runtime. |
| `model/client/document-runtimes/methods/apply.ts` | `buffer()` appends ops. The body waits for the store. | The body moves first — exactly what `slide-deck-runtimes/methods/apply.ts` already does. |
| `representation/data/types/documents/op.ts` | Targets `row · block · atom · mark`. Nothing above the rows is addressable. | A `document` target with plain field paths: page setup, furniture settings, the style set. |

> **All changes start at the runtime. Typing is the one exception.** The path
> that exists today — editor transaction → body → diff → ops → runtime — is the
> right path for keystrokes and only for keystrokes. Every panel builds its ops
> itself and applies them; the editor is re-projected from the result.

## 03 · Six model changes

| Change | File | Companion § |
| --- | --- | --- |
| `Mark.from`, `Mark.to` → `{ atom, offset }` | `representation/data/types/content/content-block.ts` | 03 |
| `AnchorWithin.text` takes the same endpoints | comment anchor type (store tables) | 13 |
| `BlockFormat` + `spaceBefore · spaceAfter · lineHeight · indent` | `representation/data/types/content/block-format.ts` | 04 |
| `DocumentOp` + target `document` | `representation/data/types/documents/op.ts` | 07 |
| `Selection` + `ranges?` | `representation/data/types/workspace/tab.ts` | 10 |
| `document-editor.empty-block` → `empty-line`; + `image` lens key; + `templates`, `prompts` context keys | `representation/data/types/workspace/views.ts` · `behavior/workspace/views.ts` · `opening.ts` · `surfaces/context/procedures/rail-entries.ts` | 10 · 12 |

Every seeded mark array is empty and every seeded comment thread anchors by
`quote` alone, so the endpoint change breaks no stored row.

## 04 · Build order

Each phase leaves the editor working. A depends on nothing; B depends on A;
everything after depends on B and, past that, only on what it names.

**A · Model.** The six changes above. The applier moves to
`representation/data/behavior/documents/apply-ops.ts` and grows every target:
block fields, atoms, marks by id, furniture roots, the document; a text splice
shifts mark endpoints on its own atom. The capability wraps it;
`validate-submit-document-changes` learns the new shapes. Unit tests: every op
applies and its inverse restores.

**B · Runtime.** `buffer()` applies to `runtime.body` before appending; refusal
fails the call and buffers nothing. The runtime holds the mounted editor while the
surface is on screen; a body change that did not come from the editor re-projects
it. Re-projection reads the selection as addresses before and restores it after,
both ends, all ranges. ⌘Z and ⇧⌘Z bind to `runtime.undo` / `redo`;
`prosemirror-history` is removed. An accept that carries catch-up ops applies them
to the live body.

**C · Projection.** Seven mark types with `markId`; `text_block` attributes for
variant, level, listStyle, styleKey, format; `formula_atom`, `divider` and
`page_break` nodes. `docOf` splits an atom's text into runs by mark; `bodyOf`
groups runs back by id and resolves positions to atoms by walking the block's atoms
in order. `translate` emits mark, block-field and atom ops for the typing path.
Per-block pagination metrics from the resolved style; the style set as generated
CSS on `data-style`; `toDOM` picks the element from the variant. Typesetting leaves
the Layout panel.

**D · Lenses.** `text-selection`: every control an op — marks, colour, link → mark
ops; style key, alignment, spacing → block ops; mixed state across ranges.
`empty-line`: Block with Text, Table, Image, Page break; then the whole text lens
as Text. `next-letter`: the selection lens reading stored marks. `named-style`:
identity with Duplicate and Delete; every field a document op; usage count read
first. `table`, `image`: the block's own fields; `prompt-block` stays a
placeholder. `general.comment`: anchor, reply, resolve, thread.

**E · Panels.** Sections from heading variants, line and page computed per row.
Find and Replace through text ops, one undo group. Styles: actions, search, rows
with Apply; select opens the lens; the default set written on first styling.
Layout: reads the runtime; paper with Custom, orientation, margins, header, footer,
page numbers all write document ops. Comments: open threads as quote blocks;
selecting one scrolls to and lights its anchor. Rail:
Sections, Find, Styles, Layout, Comments, Variables, Templates, Prompts; landing on
Sections; Overview, Insert and Context leave the rail.

**F · Furniture.** Header and footer roots projected as their own editor views,
drawn on every page, one canonical editor each, entered from Layout's buttons.
Furniture row ops carry their root in the path. Page numbers generated from
`pageNumber`.

**G · Comments.** Threads and comments read through the store; anchors resolved by
address. `gutterOf` returns a leading and a trailing number; the trailing gutter
reserves the lane. A decoration set for the tints; the lane and its five states.
Create thread and first comment on a selection; reply; resolve.

**H · Ranges.** A ProseMirror `Selection` subclass holding a primary range and
others; a plugin drawing the others; ⌘-drag adds a range. `signalOf` emits all
ranges; lenses apply each op once per range.

### Out of this round

Editing inside tables and images, inserting formula atoms and prompt blocks (both
draw), list rendering, rulers, margin guides, block drag handles, presence,
resolved threads in the panel, mentions and activity rows for comments, and the
Pages view of the Sections panel.
