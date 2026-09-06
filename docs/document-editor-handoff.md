# Document editor — handoff

Written 2026-09-05, updated the same day after Phases A–H landed. Everything
below is verified against the code and against the running app, not the docs.

---

## 1 · Where everything is

### The worktree and branch

```
worktree   /home/jakul/cyberia/icarus-document-editor
branch     work/document-editor
based on   77473ca  feat: align resource representations and product surfaces  (= main)
commits    7, all on the branch, none on main
```

```
55a7b22  feat(document-editor): a modifier drag adds a range instead of replacing the selection   (H)
b70d0b8  feat(document-editor): comment threads tint their text and sit in the gutter             (G)
fae879e  feat(document-editor): headers, footers and page numbers on every page                   (F)
3d9b633  feat(document-editor): context panels read the runtime and write ops                     (E)
c4a542e  feat(document-editor): inspector lenses write ops, comments and links land in the store  (D)
967064e  feat(document-editor): the editor draws the whole model                                  (C)
62be118  feat(document-editor): the op spine and the live body                                    (A, B)
```

The branch is clean: `git -C ../icarus-document-editor status` shows nothing.
`git diff --stat main..work/document-editor` is 78 files, +8064 / −1355.

To work in it:

```bash
cd /home/jakul/cyberia/icarus-document-editor/app
nix develop ../infra/devshell --command pnpm dev --port 5200
```

The command above starts the app at `http://localhost:5200/app/dev-project`
(the session's dev server was stopped at the end; nothing is running).
**`dev-project` is a token, not the project id**; `/app/default` returns "No such
project". The token is set in `app/configuration/dev.yaml`.

Open *Winter readiness brief* from the launcher by **double-clicking** its row.
A single click only inspects it.

One thing to know about the dev server: `surfaces/context/context.svelte` and
`surfaces/inspector/inspector.svelte` discover panels with `import.meta.glob`, and
Vite does not always notice a **new** `.svelte` file in those globs. If a new
panel shows "Not built yet", restart `pnpm dev`. Editing an existing panel hot
reloads fine.

To bring the work in, merge or rebase the branch yourself; nothing here runs git
on `main`:

```bash
cd /home/jakul/cyberia/icarus
git merge work/document-editor
git worktree remove ../icarus-document-editor      # only when you are done with it
```

### The artifacts

| Page | URL | Mirror in this repo |
| --- | --- | --- |
| The Document Editor, End to End — the goal state | https://claude.ai/code/artifact/c5fe6446-0706-4a84-bbd7-a893893a5d8f | `docs/artifacts/document-editor-end-to-end/` |
| Document Editor Buildout — the delta and build order | https://claude.ai/code/artifact/86a5a41d-1b83-4097-a77c-ee2ce064d9c3 | `docs/artifacts/document-editor-buildout/` |

The goal-state page is the spec and still reads true. The buildout page is now a
record of the plan that was followed; its "what is missing" sections describe
the state before this branch.

---

## 2 · The architecture that was agreed, and is now built

> The client runs the live document. The document in the back end is the
> canonical document. The editor is just an interface for the user to
> communicate the changes they want to make to the document model.

- The store holds the canonical `DocumentBody` (`documentSnapshots`, `role: "leader"`).
- The client runtime holds a **live** copy. Every change — from a lens, a panel,
  undo, or sync — is ops applied to that copy **first** (`apply-ops.ts`, shared
  with the server), then flushed.
- ProseMirror is a **projection** of the live body and an input device. Typing
  and selection are the one exception: a keystroke lands in the editor first and
  is translated to ops immediately after (`translate.ts`).
- Undo is the runtime's op stack, inverted. `prosemirror-history` is gone.
- Every address is structural: `(blockId, atomId, offset-into-that-atom's-display)`.
  Marks, comment anchors, selections and find hits all use it.
- Catch-up accepts: a change set against an older revision is accepted when the
  changes that landed since touch unrelated paths; their ops return as `catchUp`
  and are applied to the live body.

The decisions table from the first handoff still holds (Heading 1 is a style,
`heading` the variant; spacing edits write the block; multi-selection is
non-contiguous; page breaks are a row kind; `empty-line` replaces `empty-block`;
header/footer/page numbers in scope; no margin guide; comment icons live in the
pasteboard gutter, never on the page).

---

## 3 · What is done, phase by phase

Every path below is under `app/src/lib/`. Files marked *new* did not exist on `main`.

### A · Representation

- `representation/data/types/…` — `MarkEnd`, `AnchorEnd`, `BlockFormat` spacing
  fields, `DocumentTarget` gains `document`, `Selection.ranges`, vocabulary keys
  (`empty-line`, `image`, `templates`, `prompts`).
- `representation/data/behavior/documents/apply-ops.ts` *new* — the one applier:
  text splices with mark shifting, row/block/atom/mark/document `set`,
  `insert`/`remove`/`move` across the body and furniture roots, named styles,
  `invert`/`invertAll`.
- `representation/data/behavior/workspace/opening.ts` — the document rail is
  Sections · Find · Styles · Layout · Comments · Variables · Templates · Prompts,
  landing on Sections.
- `capabilities/document/…` — thin wrapper over the applier, the `document`
  target accepted, catch-up accepts.

### B · Runtime

- `model/client/document-runtimes/methods/apply.ts` applies before buffering;
  `flush.ts` applies `catchUp`; `history/invert.ts` re-exports the shared invert.
- `DocumentRuntime` gained two channels the lenses and panels use to reach the
  editor without importing it: `pendingMarks` (marks for the next letter) and
  `scrollTo` (a block id to bring into view).

### C · Projection

All in `app-views/categories/document-editor/procedures/`:

- `schema.ts` — nodes for pages, rows, dividers, page breaks, text blocks with
  every block field as attrs, image/table/formula atoms, inline formula atoms;
  marks `bold · italic · underline · strike · code · link · colour`, each with a
  `markId`.
- `projection.ts` — `docOf` splits atoms into runs at mark boundaries; `bodyOf`
  rebuilds atoms and marks (splitting a mark that diverged, with fresh ids);
  `addressAt`, `positionOf`, `linearOf`, `endAt` translate between structural
  addresses and ProseMirror positions.
- `translate.ts` — typing, block field changes, mark changes, row and block
  insert/remove/move as ops; now takes a `root` so furniture edits produce
  `header/rows` and `footer/rows` paths.
- `styles.ts` *new* — the default style set, `resolve(set, key, format)`, style
  ops (`applyStyleOps`, `styleFieldOps`, `duplicateStyleOps`, `deleteStyleOps`,
  `defaultStyleOps`, `newStyleOps`, `ensureStylesOps`).
- `paginate.ts` — per-block heights from the resolved style; `page-setup.ts` —
  named papers plus Custom, gutters with a lane for the comment pins.
- `content/document.svelte` — no history plugin; `Mod-z`/`Mod-y` go to the
  runtime; re-projection keeps the selection; reacts to `pendingMarks`,
  `scrollTo`, furniture, annotations, and a selection chosen outside the editor.

### D · Inspector lenses (`inspector/`)

Every control is an op on the runtime. Comments and replies are store rows
written with `create`/`update`/`remove` from `$capabilities/store/index.remote`.

| Lens | Key | What it does |
| --- | --- | --- |
| `text-selection.svelte` | `document-editor.text-selection` | Quote and count; Style select, font family and size, marks (with mixed state), alignment, foreground and background swatches; Spacing (before, after, line height, indent) written to the block's `format`; Comments (threads on the selection, compose a new thread); Links (add a URL link, remove one). |
| `empty-line.svelte` *new* | `document-editor.empty-line` | Block select (Text, Table, Image, Page break — replaces the block or the row); Style controls; marks and colours go to `runtime.pendingMarks` for the next letter; Placement. |
| `next-letter.svelte` *new* | `document-editor.next-letter` | Marks at the caret, toggled into `pendingMarks`; style, font, alignment, spacing on the block; Placement. |
| `named-style.svelte` *new* | `document-editor.named-style` | Name, key, shorthand, Make default; typography (font, size, weight, italic, line height); spacing; usage count; Duplicate and Delete (the default cannot be deleted). |
| `table.svelte` *new* | `document-editor.table` | Rows, columns, header rows; Placement. |
| `image.svelte` *new* | `document-editor.image` | URL (Enter to set), alt text, preview; Placement. |
| `header.svelte` / `footer.svelte` *new* | `document-editor.header` / `footer` | A mini editor over the furniture rows (`procedures/furniture-editor.ts`), Add/Remove, Done. |
| `general/comment/comment.svelte` *new* | `general.comment` | The anchor quote with author and time; Reply, Resolve/Reopen and Show in document above; the thread as quote blocks with the name at the bottom; a reply composer. Helpers in `general/comment/threads.ts`. |

Procedures behind them: `blocks.ts` (format ops, block type ops, table shape,
image ops, placement), `marks.ts` (ranges from a selection, coverage, style /
colour / link ops, marks at a caret), `comments.ts` (threads for a document,
anchors from selections, quotes, threads on a selection, row builders),
`colours.ts` (the swatch sets), `store.ts` (table queries, viewer id, project
id, refresh).

A detail worth keeping: a lens holds its own `tableQuery(...)` instances and
refreshes *those* after a write. Calling `read()` again from an event handler
returned a query the lens was not rendering from, and nothing updated.

### E · Context panels (`context/`)

| Panel | What it does |
| --- | --- |
| `navigator.svelte` *new* | Sections: headings nested by level, each with `l.N · p.N` (line in the document, page). Selecting one scrolls there and puts the caret at its start. |
| `find.svelte` *new* | Find / Find and replace mode, match case, hits with the words around them; selecting a hit selects it in the editor; Replace per hit and Replace all, as text ops. |
| `styles.svelte` *new* | New style above; filter; a row per style with its shorthand and usage, an Apply button (applies to the blocks under the selection), and selecting a row opens the named-style lens. |
| `layout.svelte` rewritten | Paper (named or Custom with width and height), orientation, margins, header and footer on/off with distance from edge and Edit buttons, page numbers (position, start at, hide on first page), dimensions read-only. All document ops. |
| `comments.svelte` *new* | Open threads as quote blocks (quote, first remark, author, when); selecting one scrolls to it and opens the thread; resolved threads in a collapsed section. |

Variables, Templates and Prompts stay on the rail as placeholders, as agreed.

### F · Furniture

- `procedures/furniture.ts` *new* — a decoration plugin that draws a header
  and/or footer widget on **every** page from the body, with the page number
  where Layout puts it (`startAt`, `hideOnFirstPage` honoured, `firstPageRows`
  used on page one when present).
- `procedures/furniture-editor.ts` *new* — the mini editor the header and footer
  lenses mount; it stamps ids after every transaction and translates with the
  furniture root.
- `procedures/layout.ts` *new* — page setup, furniture and page-number ops.

### G · Comments in the document

- `procedures/annotations.ts` *new* — resolves each open thread's anchor to a
  span in the projection, decorates it (`comment-anchor`, `comment-current`),
  and stacks gutter pins that share a line.
- `content/document.svelte` — a lane in the trailing gutter with a pin per
  thread. Five states: **open**, **current** (the thread in the inspector),
  **stack** (several threads on one line, with a count; clicking cycles through
  them), **detached** (dashed — its text is gone), **resolved** (not drawn on
  the page; listed in the Comments panel's Resolved section).
- New threads and replies from the lens appear in the gutter without a reload.

### H · Non-contiguous selection

- `procedures/multi-selection.ts` *new* — a `Selection` subclass with a primary
  range first and the others after, a plugin that combines the held selection
  with a **Ctrl/Cmd-drag** into one, decorations for the secondary ranges, and a
  plain click that drops back to one range.
- `signalOf` sends the extra ranges as atom addresses in `selection.ranges`;
  `rangesOf`/`blocksIn` in `marks.ts` already expand them, so every lens control
  applies to all ranges. Typing over a multi selection replaces every range.

### Tests

`pnpm test`: **65 files, 652 tests, all passing.** New files under
`procedures/test/unit/`: `blocks`, `comments`, `styles`, `outline`, `find`,
`layout`, `furniture`, `annotations`, `multi-selection`; plus
`representation/data/behavior/documents/test/unit/apply-ops.test.ts`.

---

## 4 · What to check

From `/home/jakul/cyberia/icarus-document-editor/app`, inside
`nix develop ../infra/devshell --command …`:

```bash
pnpm typecheck   # expect: 0 errors, 0 warnings (2225 files)
pnpm test        # expect: 65 files, 652 tests, all passing
pnpm lint        # expect: 63 checks · 63 clean
```

All three were green at `55a7b22`.

### By hand, in the running app

Open *Winter readiness brief* (double-click). Then:

1. **Typing.** Type, Enter, Backspace. The title bar settles on *Saved*. `Ctrl+Z`
   undoes through the runtime.
2. **Text selection lens.** Drag across some text. Bold/Italic/Underline toggle
   marks you can see; Style → Heading 2 makes an `h2`; FG/BG swatches colour the
   text; Spacing → Before 40 moves the block down 40px.
3. **Comments.** In the same lens, expand Comments, write one, Add comment. The
   count goes to 1, a pin appears in the gutter beside the line, the text is
   tinted. Click the pin: the Comment lens opens, the pin and tint turn active.
   Reply and Resolve there; Reopen brings it back.
4. **Links.** Expand Links, paste a URL, Add link. The text becomes a link; Remove
   takes it away.
5. **Empty line.** Press Enter at the end of a paragraph: the Empty line lens.
   Toggle Bold, type: the letters are bold. Block → Table replaces the line with
   a table and opens the Table lens; Rows 5 grows it.
6. **Sections panel** (first rail icon). Headings appear with `l.N · p.N`;
   selecting one scrolls to it and lands the caret there. No headings? Apply a
   Heading style first.
7. **Find** (second icon). Type a word; hits list with context; selecting one
   selects it in the editor and opens the Text selection lens. Switch the mode to
   Find and replace, set a replacement, Replace all.
8. **Styles** (third icon). Rows with usage counts. Put the caret in a block and
   press Apply on Quote: the block becomes a blockquote. Select a row: the
   named-style lens; change its size and every block in that style follows.
   New style adds one and opens it; Duplicate and Delete work from the lens.
9. **Layout** (fourth icon). Paper A5 resizes the page; Landscape turns it;
   margins move the text; Footer on + Page numbers Right puts `1`, `2` at the
   bottom right of each page; Header on, Edit header, type: the same text on
   every page.
10. **Comments panel** (fifth icon). Open threads as quotes; selecting one scrolls
    and opens the thread. Resolved threads under Resolved.
11. **Multi-selection.** Drag one range, then hold **Ctrl** (or Cmd) and drag
    another. Both are lit; the lens says "Plus 1 more range"; Italic italicises
    both. A plain click clears it.
12. Reload: everything above persists, including comments and the header.

### Where the scripted checks live

The browser walkthroughs used during this session are Playwright scripts in the
session scratchpad
(`/tmp/claude-1000/-home-jakul-cyberia-icarus/6b938250-…/scratchpad/wt-*.mjs`,
run with `node` from the devshell against port 5200). They are not part of the
repo; the by-hand list above covers the same ground.

---

## 5 · Known limitations and what is not done

These are real and were chosen, not overlooked.

1. **Comment anchors do not move when the text around them changes.** A thread's
   `within` is stored on the row and the applier shifts *marks*, not thread rows.
   Typing before an anchored span leaves the tint where it was; deleting the
   block detaches the thread (dashed pin, "the text this was on is gone"). The
   fix is a server-side shift of `commentThreads.within` when a change set lands,
   or a client-side re-anchor on flush.
2. **Images accept a URL only.** `ImageSource` has `file` and `storage` variants;
   the lens writes `{ kind: "url" }`. Uploads need the external-files capability.
3. **Tables are a placeholder on the page.** The table block draws as
   "Table · N rows" and is shaped from the lens; cells are not edited in place.
4. **Formula blocks and inline formula atoms draw but are not edited**; the
   `document-editor.formula` lens key exists with no file.
5. **`firstPageRows`** are drawn when present but no lens writes them.
6. **Find selects the primary hit only in the editor**; Replace all handles every
   hit. A match that crosses two atoms (for example across a formula atom) is not
   offered, because one text op cannot replace it.
7. **A multi selection is kept across typing and mapping, but a full
   re-projection** (a body change from outside the editor) restores only the
   primary range.
8. **Styles rendered per block, not as a stylesheet.** Each block carries its
   resolved style inline (`inlineStyleOf`). Fine at this size; a generated
   stylesheet keyed on `data-style` would be lighter for long documents.
9. **The viewer is joined on display name.** `procedures/store.ts` (and the
   overview's own `scope.ts`) find the current user by matching `username()` to
   `users.displayName`, because only the name reaches the browser today. When
   the auth capability lands, replace with the session's user id.
10. **Variables, Templates, Prompts** panels are placeholders, as agreed.
11. **`docs/tables/content.md`** still describes `Mark.from`/`to` as numbers and
    `Mark.link` as a string. Schema docs are yours; it has not been touched.

---

## 6 · Open questions

1. **Line numbers in Sections.** `l.N` is the line within the whole document
   (lines accumulate across pages), `p.N` the page. If you want the line within
   the page instead, `placedRows` in `procedures/outline.ts` is the one place.
2. **A `chart` content type.** Still no `ContentBlock` variant for it; the goal
   page keeps it as a placeholder lens.
3. **Where resolved threads belong on the page.** They are hidden from the
   gutter now and listed in the panel. A muted pin was the other option.
4. **Comment anchor shifting** (limitation 1) is the one piece of this feature
   that touches the server. Worth deciding before comments are used in earnest.
