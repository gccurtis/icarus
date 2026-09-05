# Slide Deck Editor Buildout

Published at https://claude.ai/code/artifact/852e9aaf-7339-4b0a-9aa4-aba6e226645b

Third pass, 2026-09-05. The design for the deck editor across the
representation, the client runtime and the editor — and a first build of it on
the branch `work/slide-deck-editor`, checked out at
`.claude/worktrees/slide-deck-editor`. Nothing is committed. 606 tests pass;
typecheck and lint are clean for every file touched.

## Where it stood

One content view (a Konva stage), two of fifteen context panels, no inspector,
six op shapes. Selection was a private `$state` in `deck.svelte` and nothing
called `view.inspect`. The slide was drawn twice — Konva on the stage, DOM in
the Slides thumbnails.

## The three tiers

| Tier | Answers | Holds |
| --- | --- | --- |
| `representation/data/{types,behavior}/slide-decks/` | What a deck **is** | `SlideDeckBody`, `SlideDeckOp`, one pure `applyOps` both parties run |
| `model/client/slide-deck-runtimes/` | What is **unsaved** | body, revision, sync, op buffer, two history stacks. One per deck |
| `app-views/categories/slide-deck-editor/` | What is **seen** | content view, context panels, lenses, `components/` for shared lens sections, `procedures/` |

## The element, as built

```
SlideElement = {
  id, frame, rotation?, overflow?, paint?: ElementPaint, locked?, fromPlaceholder?,
  content: ElementContent
}
ElementContent =
  | { type: "text";  block: TextBlock }                    // one block; newlines inside it
  | { type: "shape"; shape: ShapeKind; block?: TextBlock }
  | { type: "line";  from: Point; to: Point; ends?: { start?: LineEnd; end?: LineEnd } }
  | { type: "image"; block: ImageBlock }
  | { type: "table"; block: TableBlock }
  | { type: "chart"; spec: Record<string, unknown> }       // reserved
  | { type: "group"; children: SlideElement[] }            // children in fractions of the group
ElementPaint = { fill?, stroke?: { color, width, dash? }, opacity?, cornerRadius?, shadow? }
SlideLayout gains id.
```

- A text element holds one `TextBlock`; a line break is a `\n` in `display`.
  Horizontal and vertical alignment are `block.format`; font, size, weight,
  leading and spacing are the named style's.
- A group's frame is in slide fractions; its children's are fractions of the
  group. Grouping is a remove plus an insert in one change set, landing where
  the topmost member was. Ungroup rewrites children back to slide fractions.
- The comment on `TextBlock` in `content-block.ts` still says a block holds no
  newlines; nothing enforces it and that file was left alone.

## The applier, as built

Path-first. The first segment is one of the body's own fields or an id found
anywhere in the deck; `set` walks as deep as the path goes and refuses only into
a primitive or onto a list of identified things, which `insert`, `remove` and
`move` own. A `set` with `null` removes the field. Text ops splice a literal atom
and shift the marks they pass through. `target` is optional on `set`; there is
no `deck` target.

Every op in the ledger is accepted. Emitted by the editor today: frame, rotation,
paint, lock, overflow, shape kind, line endpoints and arrowheads, delete and
duplicate, restack (verbs and drag in Layers), group and ungroup, typing into a
box, a cell or the notes, named style and alignment on a block, marks and
colour on a range, table rows and columns, image URL and alt, slide hidden,
background and layout, speaker notes, aspect ratio, theme, named styles, new
layout. Accepted but not yet emitted: insert an element (no affordance), cell
spans, image crop.

The runtime flattens every op to plain JSON on `apply`: the store refuses a change
set that carries one object instance twice as "a cycle", and Svelte's state
proxies would otherwise cross the wire.

## The frame, as built

- **Strip:** Previous · Next · Notes · − 100% + · Saved. 100% is fit.
- **Rail:** Slides · Templates · Variables · Layers · Layout · Theme · Find ·
  Comments · Prompts. Out: Overview, Stage, Notes, Context, Insert.
- **Renderer:** `components/authored/slide-surface/` — DOM + SVG, one component
  for the stage and the Slides thumbnails. Eight handles, a rotation handle, line
  endpoints, snap guides with names (Alt suspends), marquee, comment badges.
  Konva is no longer imported.
- **Text engine:** `slide-surface-text.svelte` + `procedures/typing.ts`. Runs
  from marks, `beforeinput` → ops, caret reported to the inspector, range held
  while a lens acts on it. Serves boxes, shapes, cells and notes.
- **Comments:** a badge on an object opens a *Comments on Shape* lens listing
  its threads; a row opens `general.comment`. Slide-level threads badge the slide.

## Context panels, as built

Slides (New ▾ from a layout, outline verbs, real thumbnails, gap drop zones,
section bands, notes band) · Layers (front-first, groups as branches, lock, drag
to restack, shift-click to add) · Layout (slide size, apply, cards, new layout) ·
Theme (background, type, colours, named styles edited in place) · Find/Replace
(real text ops) · Comments (chips Deck / Slide n / selected object; composer
inert) · Variables (mock) · Templates, Prompts (placeholders).

## Lenses, as built

Slide · Shape · Line · Text · Image · Table · Group · *n* objects · Text selection
· Next letter · Speaker notes · Comments on an object · Chart (placeholder).
Composed from shared sections in `components/` — geometry, order, paint, effects,
text style, arrange — each taking an id and reading the runtime itself.

## Settled

Every op in scope · the rail and the lenses as above · strip without the ratio,
100% is fit · element has a type and *has* one content · paint on the element,
vertical alignment in styling · multi-selection is `ids`, a transient group ·
notes on the slide, edited in the lens · comments anchor to elements · no
ProseMirror on the slide · undo/redo and the first cut parked.

## Still open

| | Question | State |
| --- | --- | --- |
| O4 | How does an object get onto a slide? | Open — `newElement()` and the insert op exist; nothing calls them |
| O6 | Does the document adopt the same text engine? | Open |
| O7 | `BlockFormat` against `TextStyle` | The deck reads two fields; the larger conversation is open |

## Not built yet

Adding an object · posting a comment (needs the current user and project ids on
the client) · flip · layout editing in place · image files from the project ·
chart · undo and redo · removing `konva` from `package.json`.
