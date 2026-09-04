# Slide Deck Editor Buildout

Published at https://claude.ai/code/artifact/852e9aaf-7339-4b0a-9aa4-aba6e226645b

Everything the deck editor is today, measured from the code rather than the docs,
and everything it has to become to read as professional — across the
representation, the client runtime and the editor. Nine decisions have to be
settled first; the published page takes an answer to each in place and keeps it.

Read against `work/semantic-overlay-cutover` on 2026-09-04, with the app running
at `localhost:3000`.

## Where it stands

| | |
| --- | --- |
| Content views | 1 — `content/deck.svelte`, a Konva stage |
| Context views | 2 of 15 — only `slides` and `stage`; the rest render the placeholder |
| Inspector lenses | 0 of 11 — there is no `inspector/` directory |
| Op shapes the applier accepts | 6 — everything else is refused by name |

The plumbing is finished and the surface is barely started. The runtime is
complete and symmetric with the document runtime — buffer, coalesce, rebase,
undo, redo, heartbeat, all tested — and the change-set path to the store works
end to end.

Every declared view key already exists in the vocabulary, and the surfaces
resolve a key to a file by path. The panel tree is **routable and empty**:
writing `inspector/shape.svelte` is the entire registration step. The expensive
work is the op vocabulary underneath and the renderer above.

## The three tiers

| Tier | Answers | Holds |
| --- | --- | --- |
| `representation/data/{types,behavior}/slide-decks/` | What a deck **is** | `SlideDeckBody`, `SlideDeckOp`, one pure `applyOps` both parties run |
| `model/client/slide-deck-runtimes/` | What is **unsaved** | body, revision, sync, op buffer, two history stacks, `StageSettings`. One per deck, never per tab. A courier — it does not know what a slide is |
| `app-views/categories/slide-deck-editor/` | What is **seen** | the content view, the context panels, the lenses, and `procedures/` — the only place in the tree that names an op |

A view leaf may import its own category's `procedures/`, the component aliases,
`$model/client/workspace-state` and `$capabilities/*`. It may not touch the
runtime register or `$representation`, which is why every deck type a view needs
is re-exported through `procedures/deck.ts`.

**The break that stops every inspector.** Selection is a private
`let selected = $state<string | undefined>()` inside `deck.svelte`. The inspector
is driven by `view.inspected` and `view.selection` on workspace state, and
nothing in the deck editor ever calls `view.inspect(…)`. Clicking a shape draws a
Konva transformer and tells no one. The document editor already does this
correctly, in `procedures/inspecting.ts`.

### One gesture, all the way through

`dragend` → `toFrame` → `withElementFrame` returns `{ body, ops }` together →
`runtime.apply(ops)` is optimistic at once and arms the debounce → `tick`
flushes at 50 ops or 2000 ms, `coalesce` folding a whole drag into one op →
`submitSlideDeckChanges` checks `baseRevision` and runs the same `applyOps` →
a change-set row and the advanced leader snapshot land together → the runtime
adopts the revision, then syncs on the 5000 ms heartbeat.

A refusal is an answer, not a throw. `stale` means rebase and retry once;
`unresolved` means an op named something the body does not hold — revert.

## What a deck actually is

```
SlideDeckBody = { aspectRatio, theme, styles, layouts, slides, sections }
Slide         = { id, layoutKey?, elements, notes: ContentBlock[], background?, hidden? }
SlideElement  = { id, frame, rotation?, blocks: ContentBlock[], overflow, fromPlaceholder?, format? }
Frame         = { x, y, width, height }        // fractions 0–1 of the slide
BlockFormat   = { horizontalAlignment?, verticalAlignment?, background?, border?, padding?, valueFormat? }
```

- **An element has no kind.** `textOf(element)` finds the first text block; if
  there is one the renderer draws a `Konva.Text`, otherwise a `Konva.Rect`. An
  empty text box and a rectangle are the same object; an image and a table each
  render as a blank rectangle. One inspector per kind cannot be written honestly
  on top of a guess.
- **There is nowhere to put slide paint.** No opacity, shadow, corner radius,
  dash, cap or join. The only paint an element carries is `BlockFormat`, which
  documents and spreadsheets share.
- **Spacing and alignment are already there.** `slide-decks/style-set.ts` and
  `documents/style-set.ts` are the same file twice — `TextStyle` carries
  `lineHeight`, `spaceBefore`, `spaceAfter`, `horizontalAlignment` and `indent`
  in both. The gap is a renderer that reads them, an inspector that writes them,
  and an op that carries the write — the same three-part gap on both editors,
  which is what will keep them matched.
- `notes: ContentBlock[]` already sits on every slide, unused. Speaker notes need
  no schema work at all.

## What the applier takes

Built today:

| Gesture | Op | Target | Path |
| --- | --- | --- | --- |
| Move or resize an object | `set` | `element` | `<el>/frame` |
| Re-anchor a section | `set` | `section` | `<sec>/firstSlideId` |
| New or duplicate a slide | `insert` | `slide` | `slides` |
| Delete a slide | `remove` | `slide` | `slides` |
| Reorder slides | `move` | `slide` | `slides` |
| Add or drop a section | `insert` / `remove` | `section` | `sections` |

Missing:

| Gesture | Op | Target | Path |
| --- | --- | --- | --- |
| Rotate | `set` | `element` | `<el>/rotation` |
| Fill, stroke, opacity, shadow, corner | `set` | `element` | `<el>/paint` |
| Name an object (Layers needs a label) | `set` | `element` | `<el>/name` |
| Overflow | `set` | `element` | `<el>/overflow` |
| Insert a shape, text box, image, table | `insert` | `element` | `<slide>/elements` |
| Delete an object | `remove` | `element` | `<slide>/elements` |
| Restack | `move` | `element` | `<slide>/elements` |
| Type | `text` | `atom` | `<blk>/atoms/<atm>` — the document has this |
| Split or join a paragraph | `insert` / `remove` | `block` | `<el>/blocks` |
| Reorder paragraphs | `move` | `block` | `<el>/blocks` |
| Apply a named style | `set` | `block` | `<blk>/style` |
| Alignment and spacing | `set` | `block` | `<blk>/format` |
| Bold, italic, link, colour a range | `insert` / `remove` / `set` | `mark` | `<blk>/marks` |
| Hide a slide | `set` | `slide` | `<slide>/hidden` |
| Slide background | `set` | `slide` | `<slide>/background` |
| Apply a layout | `set` | `slide` | `<slide>/layoutKey` |
| Aspect ratio, theme, named styles | `set` | `deck` | there is no such target |

**Two structural blocks, not twenty-two separate ones.** `DeckTarget` is
`slide | element | section | block | atom | mark`, so nothing addresses the
body's own fields. And `applySet` destructures `[id, field, ...rest]` and
refuses a non-empty `rest`, so `theme/colors/text` is unreachable by
construction. Both have to land before any theme panel can write.

The document's applier is the template for most of the rest: `applyText`,
`mapBlock`, `insertAfter` and `withoutIds` already do the work, and the deck's
copy differs only in reaching a block through `slide → element → blocks` rather
than `row → blocks`.

## The editor today

| What it does now | What is wrong with it |
| --- | --- |
| Draws the slide with Konva — one stage, one layer, a transformer with resize and rotate off | No resize, no rotate, no text editing. A text element is one `Konva.Text` of `block.display`, no marks, no alignment. Paint order is array order, so shapes cover the title |
| Renders the slide a **second** time in the Slides panel, as positioned `div`s | Two renderers of one structure, already drifting on which `format` fields they honour |
| Selects on click, into a local `$state` | The inspector never hears. No shift-click, no marquee, no Escape |
| Numbered pips along the bottom | A second slide selector competing with the Slides panel; does not scale |
| Zoom on ctrl + wheel, 50–200% | No visible control, no Fit, no way to discover it |
| Slides panel — new, duplicate, delete, drag-reorder, alt+arrow | Drag drops *onto* a target with a top-border marker, so the tail is unreachable and the head is awkward |
| Undo and redo on the runtime, tested | Nothing calls them. `COMMAND_IDS` holds four ids and none is undo |

## The frame to build

**The strip under the canvas.** Pips out. Previous, Next and Notes on the left;
zoom, Fit, ratio and sync state on the right. Notes opens
`slide-deck-editor.speaker-notes` in the inspector — a way in, not a tray.

**Drag-reorder.** Drop zones become the gaps, including one above the first row
and one below the last, with an insertion line where the slide will land. The op
is unchanged: `withMovedSlide(body, id, afterId)` already takes `null` for the
head.

**The rail.** Fifteen keys declared, twelve in the rail. The spine is Slides,
Layers, Layout, Theme, Variables, Templates\*, Prompts\* and Insert — Insert
because with no toolbar it is the only way to add an object. Find, Comments and
Context are the same panel in all three editors. Overview, Stage and Notes are
the open questions: the deck lens could carry Overview, the strip now carries
Stage's two useful facts, and Notes overlaps the lens.

**The inspector.** Every lens is the deck's own — copied where the shape matches
the document's, never imported. Slide, Shape, Line, Text box, Image, Table,
Multiple objects, Text selection, Next letter, Speaker notes, Deck, Theme, Named
style. Chart and the three layout lenses sit behind everything else.

## Text, shared with documents

| Piece | Document editor today | What the deck needs |
| --- | --- | --- |
| Editor | ProseMirror; schema is `doc › page › blocks_row › text_block › text` and `marks: {}` is literally empty | Same library, a different schema — no page, no row. One instance per text box |
| Body ⇄ editor | `projection.ts`; only a text block whose whole content is one literal atom is drawn, the rest carried through `putBack` | The same trick, one level shallower |
| Editor ⇄ ops | `translate.ts`; the text op is a common-prefix / common-suffix splice | Copy it; the path becomes `<el>/blocks` |
| Selection signal | `inspecting.ts` — `signalOf` returns `text-selection`, `empty-block` or `next-letter`; `worthSending` suppresses caret noise | Copy it, plus a fourth branch for an object selection |
| Held selection | `highlight.ts` keeps the range lit on blur (landed in `7730b78`) | Copy verbatim — it is what makes an inspector-driven editor feel right |
| `next-letter` lens | Not built. The signal fires and the key is declared; no file exists | Build once, copy across |
| `text-selection` lens | **A mock.** It reads the quoted text and character count; every Style control holds local state and writes nothing, and the comments and links are invented rows | Copying it today copies a mock. Making it real needs marks in the schema and a `mark` op — the same work on both sides |
| Alignment and spacing | Neither: not in the schema, not in the lens, not rendered | Already in `TextStyle` on both sides; add block spacing to `BlockFormat` once and both get it |

**Multi-text selection is one lens.** In a document, a selection crossing two
blocks is the same lens with `selection.at` on a different block. In a deck, with
one ProseMirror instance per box, a selection cannot cross two boxes at all — so
it is either a selection spanning paragraphs inside one box, which is identical,
or it does not exist.

## Objects and arrangement

Align (6 verbs) and distribute (2) are pure geometry over frames — a
`procedures/arrange.ts` with no browser in it and a test per verb. Stack order is
`move · element`. Snapping is editor-only and stores nothing. Opacity, shadow and
corner radius land on `element/paint`.

**A line is not a box.** Every other object is a `Frame`; a line is two points
with no meaningful width or height, and a diagonal in a bounding box loses which
corner it starts at the moment the box is normalised. This is the clearest single
argument for a discriminated content union on `SlideElement`.

## Nine decisions

| | Question | Recommendation |
| --- | --- | --- |
| D1 | What draws a slide? | **One DOM + SVG renderer, used at both sizes.** Retire Konva from the slide surface; text is ProseMirror, shapes are SVG, z-order is DOM order, zoom is a CSS transform. The thumbnail becomes the same renderer smaller |
| D2 | Does an element say what it is? | **A discriminated `content` union** — `text \| shape \| line \| image \| table \| chart`, with a shape carrying optional blocks so text-in-a-shape stays possible |
| D3 | Where does slide paint live? | **A deck-local `ElementPaint`** on `SlideElement`. Leave `BlockFormat` alone |
| D4 | How does a multi-selection reach the inspector? | **Add `ids?: readonly string[]` to `Selection`.** `id` stays the primary — the object the crumb names |
| D5 | One ProseMirror per box, or per slide? | **Per box, mounted while editing.** A box is an independent flow, which is what it is |
| D6 | Snapping and guides | **Snapping on, transient guides, no placed guides.** Alt suspends; a guide is drawn only while a drag is matching, and named |
| D7 | Where do speaker notes live? | **The lens is the editor.** The slide lens reads and links; no notes context panel. The deck-wide gap list becomes a band in Slides |
| D8 | Undo and redo | **The runtime owns undo.** Add `edit.undo` / `edit.redo` to `COMMAND_IDS`; disable ProseMirror's own history so one stack covers a keystroke and a drag alike |
| D9 | What is in the first cut? | **Renderer and selection first, ops behind them.** Lenses read real values and write nothing at first, exactly as the document's text-selection lens does today |

## The order of work

1. **Selection leaves the component.** A `procedures/selecting.ts` modelled on the
   document's `inspecting.ts`; add `ids?` to `Selection`. Nothing renders
   differently and the inspector starts hearing.
2. **One renderer.** A `components/slide-surface/` that draws a body at any scale;
   the thumbnail and the stage both mount it. Konva leaves `deck.svelte`.
3. **The element gets a kind, and paint.** The content union and `ElementPaint`,
   plus the applier branches for `insert · remove · move` on `element` and `set`
   on rotation, paint, name and overflow. One migration of the seeded bodies.
4. **Object lenses, reading.** slide, shape, line, text-box, image, table,
   multi-selection, and `procedures/arrange.ts`.
5. **The strip, the rail, and undo.** Pips out; Layers, Insert and Layout panels;
   `edit.undo` / `edit.redo`; gap drop zones for drag-reorder.
6. **Text, both editors together.** Marks in the schema and a `mark` op; block
   spacing on `BlockFormat`; then the deck's projection and translate, the
   held-selection plugin, and the three text lenses built once and copied.
7. **Theme, and the deck target.** A `deck` member on `DeckTarget` and a `set`
   applier that accepts a deeper path; then Theme, named styles, and the
   aspect-ratio change with its staged confirmation.

Charts, layout editing, Templates and Prompts sit behind all of it. Layout
editing is blocked on something structural: `RAILS` is keyed on the category
alone, so the deck has one rail and the three `layout-*` views have nothing to
reach them from.
