# Document Editor Buildout

Published at https://claude.ai/code/artifact/86a5a41d-1b83-4097-a77c-ee2ce064d9c3

The surface types and saves. Nothing it types has any formatting, because the
schema declares no marks, the translator emits no mark ops, and the applier
refuses everything but a row proportion. Section 02 of the artifact draws the goal
state — the surface and ten panels — as HTML mock-ups that do not survive into
Markdown; what follows is everything else.

Read against `work/semantic-overlay-cutover`. ProseMirror 1.25 on a custom schema.
Two of twenty-one panels built.

## 01 · Where it actually stands

A document opens, paginates onto Letter at 82 characters and 35 lines a page,
splits and merges rows on Enter and Backspace, emits granular `text` ops, and says
Saved. Selecting text lights the inspector's Text selection lens with a real quote
and a real character count. Everything below that quote is a mock that writes
nothing — the lens says so itself, in a collapsed section called Mock.

| Piece | State | What is true |
| --- | --- | --- |
| Page surface | real | Pasteboard, paper, margins as percentages, zoom 50–200 with ⌘-wheel, gutter that collapses before the page does. |
| Text editing | real | Typing, split, merge, history, id stamping, repagination, caret preserved across relayout. |
| Persistence | real | `bodyOf` → `translate` → change set → store, with coalescing, rebase and undrawn-row preservation. |
| Selection signalling | real | `signalOf` routes to `text-selection`, `empty-block` or `next-letter` and carries a `blockId/atoms/atomId@offset` address. |
| Bold, italic, underline, strike | mock | Local `$state` in the lens. The schema has `marks: {}`. |
| Style picker, font, size, colour | mock | Six invented style names, fifteen invented families. `styles?: StyleSet` is never read or written. |
| Comments and links | mock | Three hard-coded comments, two hard-coded links, inside the lens file. Real threads exist in the store, unread. |
| Layout panel | read-only | Reads `DEFAULT_PAGE_SETUP`, not the document. Every value is display text. |
| Sections, Find, Styles, Comments, Overview, Insert, Variables, Context | absent | Eight rail icons, eight *Not built yet* placeholders. |
| Empty block, next letter, text block, named style, document, comment thread | absent | Named in the inspector vocabulary, no lens file. |

`docs/screen-specs/document-editor.md` and the panel specs under
`docs/screen-panel-views/` are a plan, not a record. Two places they have drifted:
the spec calls the page context view `page` where the vocabulary calls it `layout`,
and it describes a local toolbar above the page that does not exist and, on the
panel specs' own argument, should not — the inspector is the toolbar.

## 02 · Where it is going

The artifact draws ten specimens. In Markdown, what they say:

**Content surface.** Headings render as headings and marks render. *Nothing is
drawn on the page that is not in the document* — no margin guide, no ruler. The
comment icons sit in the pasteboard gutter, outside the paper, because a margin can
be set to nothing and text can fill it, where nothing ever runs into the gutter.
Four icons, four states: dim at rest, lit when the pointer is inside an anchor,
filled when the thread is open in the inspector. Two threads on one paragraph stack
downward from the anchor.

**Context panels.** Sections (outline nested by level, each row carrying a computed
line and page, line first; filter over the list), Styles (actions across the top,
then search, then a row per style with its typography shorthand and an Apply
button), Layout (paper select including Custom with width and height, orientation,
four margins, derived Dimensions read-only, no Typesetting), Find (a mode control
switching Find into Replace, the second field and its two buttons appearing with
it, then the hit count and the hits), Comments (every open thread as a quote block,
no scope chips), and Templates/Prompts as `PanelPlaceholder`.

**Inspector lenses.** Text selection (quote, Style — style key, family, size,
marks, horizontal and vertical alignment as icon rows, colour pair — then Spacing
as one row of four numbers, then Comments and Links), the same lens across blocks
with every over-answered control drawn mixed, Empty block (Block, Style,
Placement), Named style (identity, typography with alignment, spacing, usage), and
the comment thread (anchor with author and time, reply and resolve, then the
thread).

**Nothing selected draws nothing.** There is no `document-editor.document` lens in
this round — the inspector's own empty state already answers it.

Every figure and sentence in the specimens comes from the seeded *Winter readiness
brief*, the real vocabulary keys, and panel components that already exist.

## 03 · Five things block everything else

1. **The schema declares no marks and the block carries no attributes.**
   `text_block` has `blockId`, `atomId` and `share`. No variant, no style key, no
   format, and the mark set is empty. — `procedures/schema.ts`
2. **The translator has no vocabulary for anything but text and structure.**
   `translate` emits a text splice, a block insert/remove, a row
   insert/remove/move, and a set on `row/proportions`. — `procedures/translate.ts`
3. **The applier refuses anything it does not already know.** `applySet` handles
   exactly `<rowId>/proportions`. —
   `capabilities/document/api/submit-document-changes/apply-ops.ts`
4. **The document runtime is not optimistic; the deck runtime is.** `buffer()`
   appends ops and leaves `runtime.body` alone. The deck already solved this with a
   shared applier both sides run. — `model/client/document-runtimes/methods/apply.ts`
5. **There is no op target for the document itself.** Targets are
   `row · block · atom · mark`; page setup and the style set live above every row.
   — `representation/data/types/documents/op.ts`

## 04 · One rule decides most of the rest

> Anything inside a block is edited through ProseMirror. Anything outside a block
> is edited through the runtime.

Marks, variant, style key and alignment go through a ProseMirror command and fall
out of the existing `dispatch → bodyOf → translate` pipeline. Page setup and the
style set call `runtime.apply` directly and the surface re-projects.

The reason is undo. Text undo is ProseMirror's `history()` plugin;
`DocumentRuntime` carries a second, separate undo stack nothing currently calls.
Routing in-block edits through ProseMirror keeps one stack and costs nothing. It
also avoids a repaint — `paint()` builds a fresh `EditorState` and would drop the
caret on every formatting press.

A view may not touch the runtime register (`runtime-through-workspace-state` greps
raw view text for `attach(`), so the channel is one method on `DocumentRuntime`:
the surface registers its `EditorView`, panels call `runtime.command(...)`.

## 05 · The op vocabulary, extended

| Target | Op and path | Carries |
| --- | --- | --- |
| `mark` | `insert · remove` on `<blockId>/marks` | Whole `Mark` values by id. |
| `mark` | `set` on `<markId>/style · /color · /link · /from · /to` | Adding italic to an already-bold range, recolouring, retargeting a link, extending a range. |
| `block` | `set` on `<blockId>/variant · /level · /style · /format` | Heading versus body, depth, named style, and the block's box — where alignment lives. |
| `document` (new) | `set` on `pageSetup · pageSetup/margins/top · styles/defaultKey` | Paper, orientation, each margin, the default style. |
| `document` (new) | `insert · remove` on `styles` | Creating and deleting a named style. `StyleSet.styles` is a record, so ids are keys and `after` is documented as ignored. |
| `document` (new) | `set` on `styles/<key>/fontSize` etc. | One field of one named style, so two people editing size and colour do not clobber each other. |

**Marks must not churn on every keystroke.** A `Mark` is
`{ id, from, to, style?, link?, color? }` with UTF-16 offsets into `display`. If
`translate` diffed mark arrays it would emit a `set` on `from` and `to` for every
mark in the block, per keystroke.

> The applier shifts offsets; the translator never mentions them. `applyText`
> already splices the atom — it also maps every mark on that block through the same
> splice. Client and server run the same function, so they cannot drift.

**One ProseMirror mark type per style, each carrying its id.** Declare
`bold · italic · underline · strike · code · link · colour` as separate ProseMirror
marks, each with a `markId` attribute; `bodyOf` groups runs sharing a `markId` back
into one `Mark`. Bolding a range that is already italic makes a second `Mark` over
the same characters, which is what makes two people formatting one paragraph merge
instead of collide.

```ts
// procedures/projection.ts — blockNode, today
schema.node("text_block", { blockId, atomId, share }, schema.text(atom.text))

// what it becomes: one text node per run of identical marks
schema.node("text_block", { blockId, atomId, share,
                            variant, level, styleKey, format },
  runsOf(atom.text, block.marks).map(({ text, marks }) =>
    schema.text(text, marks)))
```

`soleLiteral` and `drawable` stay exactly as they are. Marks are metadata on the
block that index into `display`; they are not atoms. Images, tables, formulas and
prompt blocks continue to travel through the projection untouched.

## 06 · The content surface

- **Marks.** Bold, italic, underline, strike, code, link, colour pair, with `toDOM`
  on each and CSS in the surface's existing `:global(.document-block)` block.
- **Variants.** `text_block.toDOM` emits `h1…h4 · p · blockquote · pre` from
  `variant` and `level`, with `data-style` for the named style.
- **Alignment and spacing.** Inline `text-align` from
  `format.horizontalAlignment`; margins from the resolved style's `spaceBefore` /
  `spaceAfter`.
- **The style set as CSS.** One generated `<style>` block keyed on `data-style`, so
  changing a style repaints every block using it without touching a node.
- **Comment highlights and the gutter.** Section 10.

> **Nothing is drawn on the page that is not in the document.** No margin guide, no
> ruler, no page-break hint. The panel spec argues for a dashed margin guide
> precisely *because* it removes the ruler; we are removing both. A margin is a
> number in the Layout panel and an area of blank paper, and that is the whole of
> its presence.

**Pagination stops being uniform.** `layoutMetrics` derives 82 characters and 35
lines from one body size of 16px on 26px leading, and `linesOfText` measures every
block against it. That is a number that is only true while every row is the same
size — which is why the figures come out of the Layout panel: a characters-per-line
readout on a document that has headings is a fact about nothing.

They stay computed, per block. `linesOfBlock` takes the block's resolved style,
works out how many characters of *that* size fit the measure it has, and converts
its leading and its space before and after into the same body-line unit the packer
counts in. Change a font size and the block's own budget changes with it.

**The trailing gutter becomes structural.** `gutterOf` returns one number used as
symmetric padding, collapsing to `MINIMUM_GUTTER` — 0.75rem — before the page gives
way. An icon lane does not fit in 0.75rem. Putting comments there means the
trailing side reserves a fixed lane and only the leading side goes on collapsing,
so the gutter is two numbers rather than one.

**Repaint has to preserve the selection, not just the caret.** `lay()` already
re-anchors through `anchorAt` and `positionOf`; `paint()` does not. Changing a
margin repaginates and therefore repaints, so `paint` needs the same treatment,
extended from a point to a range.

## 07 · The inspector

| Lens | Sections | Notes |
| --- | --- | --- |
| `text-selection` (rebuild) | Selected text · Style · Spacing · Comments · Links | Style holds the style key, family, size, marks, both alignments and the colour pair; Spacing is one row of four numbers. |
| `text-selection` spanning blocks | Same | Not a second lens and not a second key. The quote counts blocks, the counts on Comments and Links grow, and any control with more than one answer draws itself mixed. |
| `next-letter` (new) | Same, minus the quote | Controls show ProseMirror's `storedMarks`, so pressing B then typing produces bold text. |
| `empty-block` (new) | Block · Style · Placement | Text selection minus Spacing. Block is a select whose only option is Text. |
| `named-style` (new) | Identity · Typography · Spacing · Usage | Reached by selecting a row in the Styles panel. Usage counts the blocks that would change, before the edit. |
| `general.comment` (new) | Anchor · Reply and resolve · Thread | `text-selection.svelte` already calls `view.inspect("general.comment", …)` and lands on a placeholder. |
| `document` | — | Not built. Nothing selected stays the inspector's own empty state. |

**Where alignment and spacing actually live.** Both controls sit in Style, because
both are ways the text is set. Where the value is written is the model's business:
horizontal and vertical alignment go to `BlockFormat` on the block, and a named
style may carry a default horizontal alignment that the block overrides —
`TextStyle.horizontalAlignment` already exists for exactly that. Spacing is
`spaceBefore` / `spaceAfter` / `lineHeight` / `indent`, which live only on the
style; see decision 2.

*Leading* is baseline to baseline inside a paragraph. There is no letter-spacing
field anywhere in the model, and none is proposed.

## 08 · Styles

`StyleSet` is `{ styles: Record<string, TextStyle>, defaultKey: string }` on the
body, and `TextBlock.style` is a key into it. Today no document has one and nothing
reads the field.

**Styles context panel**

- Actions across the top — New style, Duplicate, Rename — above the search rather
  than under the list. A panel this narrow puts what you can do where you look
  first.
- Then search, then a row per style: name and its typography in shorthand
  (*Heading 1 — IBM Plex Sans 24/32 · 600*).
- **Two verbs on the row, both explicit.** Selecting it opens the `named-style`
  lens beside the panel, which is where every setting is edited. **Apply** puts the
  style on the current selection. Selecting a style and applying a style are
  different intentions and a single click cannot mean both.
- A document with no `StyleSet` gets the default set written on first edit, not on
  open — opening a document should not dirty it.

**The default set** — Body, Heading 1, Heading 2, Heading 3, Quote, Caption, Code.

## 09 · Layout, made editable

| Section | Becomes |
| --- | --- |
| Paper | Two selects — six named sizes plus **Custom**, and two orientations. Custom reveals width and height in inches, which makes `PaperSize`'s `{ width, height }` variant reachable for the first time. |
| Margins | Four numbers in inches, stepped, clamped so opposing margins cannot exceed the sheet. Writes `pageSetup/margins/<side>`. |
| Dimensions | Unchanged. All three are derived and stay read-only. |
| Typesetting | **Removed from the panel.** Still computed, per block, from the resolved style. See section 06. |
| Zoom | Stays where it is. Zoom is tab view state, not document state. |

Two departures from `docs/screen-panel-views/context/resource/layout.md`, both
deliberate: there is no dashed margin guide on the page, and there is no
characters-per-line readout. Header, footer and page numbering are in that spec and
are not in this round.

## 10 · Comments

The store already has what this needs and nothing reads it. Threads carry `target`,
an optional `within` anchor, a `quote` and an optional `resolution`; the anchor's
text variant is `{ kind: "text", blockId, from, to }`. Three threads and five
comments are seeded. There is no `capabilities/comments/` directory — reads and
writes go through the generic store.

**The gutter.** A lane to the right of the page, outside the paper, one row per
thread anchored at the vertical position of its anchor's first character. Position
comes from `EditorView.coordsAtPos`, recomputed on the same relayout trigger
`lay()` already fires on.

| State | The icon | The text |
| --- | --- | --- |
| At rest | Transparent, still occupying its row | No highlight |
| Pointer over anchored text | Opaque, for every thread that text belongs to | Faint tint |
| Caret inside, or selection overlapping | Opaque, same set | Faint tint |
| Pointer over the icon | Opaque | Its own anchor tints |
| Thread selected | Filled | Strong tint, held while focus is in the panel |

Two threads on overlapping text give two icons; when they collide vertically they
stack downward and the lane keeps its order. Selecting an icon inspects
`general.comment`. The highlighting is a ProseMirror decoration set built from the
anchors, so it composes with the existing `held-selection` decoration rather than
fighting it.

**Comments context panel**

- Every open thread, newest first, drawn as the quote block the inspector uses —
  author, when, and the remark filling the width the panel has.
- **No scope chips.** The gutter already answers "what is on this page" by being
  beside it, and a selection already answers "what is on this" by being selected.
- Selecting a thread scrolls to its anchor and opens the thread lens.
- A thread whose anchor no longer resolves is shown as detached with its quote, not
  hidden.
- Resolved threads are not in the panel this round. They are kept rather than
  deleted, so somewhere has to reach them eventually — noted rather than solved.

**Writing one** — composing on a selection creates the thread and its first comment
together, with `quote` frozen from the selected text and `within` from the anchor.
Resolution sets `resolution` rather than deleting. In the thread lens the anchored
text carries who raised it and when, and Reply and Resolve sit above the
conversation rather than below it.

## 11 · Sections and Find

**Sections.** The rail already labels `document-editor.navigator` as *Sections*.
Headings nested by level, current heading marked, and a filter over the list. It
needs one thing that does not exist yet — blocks that know they are headings —
which is why it comes after variants.

Each row carries a line and a page, line first. The page is the coarse answer and
the line is the precise one, and a heading list is used to get somewhere rather than
to know what page something is on. Both are computed and neither is an identifier.
One question this raises and I have not answered: `l.14` is the fourteenth line of
page 1 here, but a line count from the top of the document is the other reasonable
reading. Per-page matches how a filing is cited; whole-document matches how a draft
is discussed.

Pages as a second view of the same region are in the panel spec, and breaks and
furniture were a third — explicit `pageBreak` rows plus a way into the header and
footer editors. Both are out: page breaks and furniture are not in this round at
all, so a section that lists them would list nothing.

**Find.** A context view rather than a dialog. One control at the top switches
between Find and Replace; choosing Replace brings a second field and its two
buttons — Replace and All — with it, so the panel is never taller than the mode it
is in. Below that, the hit count and the hits, each with its line, page and block.
Replace goes through ProseMirror so it lands in one undo step and one coalesced
change set.

## 12 · The rail

| Today | Proposed | Change |
| --- | --- | --- |
| Overview | — | Dropped. The landing view moves to Sections. |
| Sections | Sections | Built. Becomes the landing view. |
| Find | Find | Built. |
| Insert | — | Dropped. |
| Styles | Styles | Built. |
| Layout | Layout | Made editable. |
| Variables | — | Dropped. |
| Comments | Comments | Built. |
| Context | — | Dropped. |
| — | Templates | New key `document-editor.templates`. Placeholder. |
| — | Prompts | New key `document-editor.prompts`. Placeholder. |

Adding a key touches four files: the type union, the behaviour list, the rail entry
with its label and icon, and the opening rail. Dropping one only touches the
opening rail — the keys stay in the vocabulary, because the vocabulary is the plan
and the rail is what this category offers today.

A rail entry with no file already renders `PanelPlaceholder`, which names the key
and the category. Templates and Prompts need the keys, the labels and the icons;
they do not need files.

## 13 · Four decisions

### 1 · Is "Heading 1" a variant, a style, or both?

`TextBlock` carries both `variant` (`paragraph · heading · list · quote · code`,
with a `level`) and `style` (a key into the style set). The mock's dropdown lists
*Body · Heading 1 · Heading 2 · Quote · Caption · Code*, which mixes the two
vocabularies. It matters beyond naming: the Sections outline reads variants and the
Styles panel reads styles.

**Recommended** — one dropdown, two fields written together. *Heading 1* sets
`variant: "heading"`, `level: 1`, `style: "heading-1"`. *Caption* sets
`variant: "paragraph"`, `style: "caption"`. The variant is what the document is;
the style is how it looks.

### 2 · Does the Spacing section edit the style, or the block?

Spacing has its own section now and sits under Style rather than beside the marks —
that part is settled. What is not: the four values it holds (`spaceBefore`,
`spaceAfter`, `lineHeight`, `indent`) exist only on `TextStyle`. `BlockFormat` has
`padding`, which is a box property and not the same thing. So typing 12 into *After*
either edits the named style — changing every block that uses it — or needs a new
per-block field that does not exist yet.

**Recommended** — it edits the named style, and the section says how many blocks
that affects before you touch it. Per-block overrides mean four new fields on
`BlockFormat` and a precedence rule to write down.

### 3 · Multi-selection is non-contiguous — corrected

An earlier version of this page recorded this as settled in favour of a selection
running across several blocks. That was my recommendation written down as an
answer; it was not asked and not agreed. **Multi-selection means several disjoint
ranges at once.**

That lands in three places rather than one: ProseMirror needs a custom `Selection`
class and a plugin to draw the ranges; `Selection` in `workspace/tab.ts` is
`{ kind, id, at? }` — one range — and has to carry a list; and every command in the
lens applies once per range instead of once.

A selection that merely spans several blocks stays the ordinary case: one range,
same lens, mixed controls.

### 4 · How real are comments in this round?

Reading, anchoring, highlighting and the gutter are cheap once anchors are read.
Writing is a set of writes through the generic store with no capability of its own,
which means no validation and no activity rows.

**Recommended** — read, anchor, highlight and select for real; create, reply and
resolve for real through the generic store; mentions and activity deferred.

## 14 · Build order

Each phase leaves the editor working. Nothing is parallel to phase A.

**A · The op spine.** Move `apply-ops` to
`representation/data/behavior/documents/`, the capability wrapping it as the deck
does. `buffer()` applies to `runtime.body` before appending. Add the `document` op
target and its field-path grammar. Add the `command` port to `DocumentRuntime`.
`paint()` restores the selection range.

**B · Marks.** Seven mark types in the schema, each with a `markId`. `docOf` splits
text into runs, `bodyOf` groups runs back into `Mark`s. `applyText` shifts mark
offsets through the splice. `translate` emits mark insert/remove/set and `applyOps`
accepts them. The selection lens's marks, colours and link become commands.

**C · Blocks.** Four new attributes on `text_block` and `toDOM` renders them. `set`
ops on the four block fields both directions. Per-block metrics: `linesOfBlock`
takes the resolved style, so a bigger font gets a smaller character budget and
headings paginate honestly; Typesetting leaves the Layout panel. Alignment, both
axes, as icon rows inside Style. The `empty-block` and `next-letter` lenses. Mixed
states across a multi-block selection.

**D · Styles.** `StyleSet` written on first edit; document ops for create, delete
and per-field edit. The style set rendered as generated CSS keyed on `data-style`.
Styles context panel — actions above the search, Apply on the row, selection opening
the lens. The `named-style` lens with a usage count read before the edit.

**E · Layout.** The panel reads the runtime instead of the default constant. Paper,
orientation and four margins write document ops; Custom reaches the
`{ width, height }` paper variant. Dimensions recompute and stay read-only.

**F · Sections and Find.** Outline from heading variants with a computed line and
page on each row. Find with a mode control, per-hit line, page and block, and
replace through ProseMirror.

**G · Comments.** Read threads and comments through the store; resolve anchors to
positions. `gutterOf` returns a leading and a trailing number so the lane is always
there. Decoration set for highlights; the gutter lane and its five states. Comments
context panel as quote blocks; the `general.comment` lens with reply and resolve
above the thread. Create, reply, resolve.

**H · The rail.** Two new keys, labels and icons; four entries dropped from the
opening rail. Landing view moves to Sections.

### Not in this round

Header and footer furniture, page numbering, the Insert panel, the Variables panel,
the Context panel, the document lens, tables, images, formula atoms and blocks,
prompt blocks, lists and checklists, rulers, margin guides, block drag handles,
presence, resolved threads, and both the Pages and the Breaks halves of the Sections
panel. Several have vocabulary keys already and will render their placeholder, which
is the honest state for them.
