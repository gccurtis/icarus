# Document editor review and convergence plan

**Reviewed:** 2026-09-05  
**Candidate:** `work/document-editor` at `55a7b22`  
**Compared with:** `main` at `98d9cd0`  
**Runtime document:** *Winter readiness brief* at `/app/dev-project`

## Decision

Do not merge the branch yet.

The branch has the right architectural direction: the live document body, operation pipeline,
projection, real styles, comments, links, layout, furniture, and runtime undo are substantial and
worth keeping. It also regressed deliberate inspector interactions that already exist as mocks on
`main`, and it contains several correctness failures in common editing paths. The convergence target
is therefore:

> Keep the branch's engine and real data flow. Restore and refine the main branch's interaction
> design. Add browser-level regression coverage before merge.

The static gates are green, but they do not exercise the failures found here:

| Gate | Result |
| --- | --- |
| Typecheck | 0 errors, 0 warnings |
| Unit tests | 65 files, 652 tests passing |
| Architecture/style lint | 63 checks clean |
| Browser interaction tests | None for the editor paths reviewed here |
| Runtime console | `/favicon.ico` returns 404; mutation failures can throw from event handlers |

## What should stay

- The client runtime applies operations optimistically to a live `DocumentBody` and flushes them to
  the canonical store.
- ProseMirror is a projection and input surface rather than a second document model.
- Runtime undo/redo, structural addresses, real marks, named styles, page layout, comments, links,
  headers, footers, page numbers, find/replace, and non-contiguous selection are the correct scope.
- The new Sections, Find, Styles, Layout, and Comments panels are useful foundations.
- Caption is a valid named style and currently behaves acceptably.
- Variables, Templates, and Prompts can remain explicit placeholders in this round.

## Findings

### P0 — block merge until fixed

| Finding | Evidence | Required outcome |
| --- | --- | --- |
| Replacing a foreground/background color can throw. Link replacement has the same defect. | `colourOps`/`linkOps` remove the old last mark, then `insertMark` calculates `after` from the pre-removal block. `applyOps` rejects an insertion after an ID that no longer exists. This exactly matches “colors only change so many times.” | Build replacement operations against a surviving insertion anchor or replace a mark in place. Test repeated FG, BG, combined FG/BG, link edit, link remove/re-add, undo, and redo. |
| Selection highlighting is not stable across inspector mutations. | The held-selection plugin is blur-aware, but `paint()` constructs a new `EditorState`; plugin state initializes to false. The restore helper keeps only the primary `from/to` and recreates a `TextSelection`, dropping secondary ranges. | Preserve the full selection type and every range across projection, and derive the held highlight from inspection/focus state after every repaint. |
| Enter can say “Body” while still looking like Quote (and can propagate that appearance again). | `splitRow` sets the new block's style key and variant to Body defaults but copies `presentation`, font size, line height, and spacing from the source node. Because the optimistic body already matches the translated body, no corrective repaint is forced. | Add named-style continuation semantics. A new paragraph after Quote or Heading should be a freshly projected Body block in both data and pixels. |
| Ctrl/Cmd-click does not open a link and exposes raw node selection. | Reproduced in Chromium: no new page opened, the whole `What it would cost` block became selected, and `.ProseMirror-selectednode` drew a blue rectangle. There is no link-click handler in the editor. | Ctrl/Cmd-click opens the URL safely. A text block is never node-selected or outlined. |

### P1 — required for the intended editor experience

| Area | Current problem | Target |
| --- | --- | --- |
| Formatting controls | The branch changed the deliberate responsive four-control row on `main` into five wrapping chips and added Code. | Bold, Italic, Underline, Strikethrough only. All four always fill one row. Show full words when the container can hold them and B/I/U/S below that width. Keep compatibility for stored code marks, but remove Code from ordinary formatting UI. |
| Font row | Font size consumes a fixed wide control with two steppers. | Give the font family the available width and use a small directly editable numeric field for size. |
| Color | FG and BG occupy separate swatch walls; the replacement logic is broken. | Put FG and BG on one row. Extract a dedicated color-picker component with a compact trigger, named palette, “Pick from screen,” and “More colors…”. The later custom view accepts hex and a visual color field. |
| Body styling | Alignment is mixed into Style while spacing is a separate collapsed section. “Before” and “After” do not say what they are before/after. | One **Body style** section: alignment, Space above, Space below, Line height, and Indent. |
| Numeric fields | Plus/minus controls create noise throughout the inspector. A disabled decrement button triggers the vendored group's `has-disabled` rule and dims the whole field at zero, making Indent and page number look unavailable. | Input-only number fields; keyboard arrows remain. A value at its minimum must still look editable. Put shared units in the section/field label where that is clearer, e.g. “Margins (in)”. |
| Comments hierarchy | The anchored document text and each comment use the same quote treatment, so the source, opening comment, and replies blend together. | Anchored text is a distinct source block at the top. A divider separates it from the thread. The opening comment is visually primary; replies form a clearly ordered thread beneath it. |
| Detached comments | Detached pins are rendered at `top: index * 1.5rem`, so the first dashed pin floats beside the page header even though it has no anchor. | No detached pin floats on the page. Put detached threads in a clearly labeled Comments-panel group with a relink/dismiss action. |
| Comment ranges | A comment made on a cross-block selection silently anchors only from the start to the end of the first block; extra ranges are ignored. | Either support a multi-span anchor or explicitly restrict comment creation to one contiguous block. Never silently shorten what was selected. |
| Links | The real branch removed the notes textarea and note display already mocked on `main`. URLs are not normalized by scheme. | URL input followed by Notes textarea. Store the note with the link, show it in the inspector, and validate/normalize allowed URL schemes. |
| Link appearance | `.document-link` always forces interactive blue and underline. | A link mark carries navigation only. Creating one may add ordinary blue foreground + underline marks as editable defaults; the normal formatting controls can change or remove them. |
| Quote appearance | `document-quote` adds a hard-coded bar and padding on top of the named style's italic/indent. | Remove the hard-coded bar. Visible quote treatment comes from editable named/block style fields only. |
| Sections | The live panel rendered `l.11.999999999999998`, and a long heading left no usable title space. | Human-readable whole-number placement, stable title truncation/wrapping, and metadata that cannot consume the title column. |
| Header/footer | Edit opens a miniature inspector editor. The page widget flattens furniture to `textContent`, so stored formatting is not rendered. | Edit in the page canvas. Focus a canonical header/footer content root on the page and expose the normal text inspector so all ordinary styles work. Repeat its styled projection on other pages. |
| Header/footer geometry | “From edge” fields add detail that is not needed for the intended model. | Remove the fields from the panel; keep a safe default internally for compatibility. Alignment and indent supply the author-controlled layout. |
| Page numbers | With “Hide on first page,” the implementation still adds the hidden page index, so `startAt: 1` makes page two display 2. | Treat Start at as the first **visible** number. Hiding the first-page number should make page two show 1 by default. |
| Orientation | Portrait and Landscape wrap vertically in the narrow context rail. | Keep both choices on one full-width row; abbreviate only below the width needed for the full labels. |
| Panel hierarchy | Controls and sections use nearly the same surfaces and borders, causing content to blend together. | Stronger section rhythm: clearer headings/rules, compact key/value rows, one primary surface for editable fields, and distinct selected/disabled states. |
| Console cleanliness | A normal valid workspace emits a 404 for `/favicon.ico`; interaction exceptions are not caught at the control boundary. | Zero errors/warnings/failed requests in the normal editor path. Add the icon and present recoverable mutation failures in the panel rather than as uncaught errors. |

### Code evidence index

Line references below are pinned to candidate `55a7b22` and are relative to `app/src/lib` unless
otherwise noted.

| Finding | Candidate source |
| --- | --- |
| Stale insertion anchor during mark replacement | `app-views/categories/document-editor/procedures/marks.ts:186`, `:191`, `:323`, `:366`; `representation/data/behavior/documents/apply-ops.ts:28`, `:36`, `:349` |
| Selection/highlight loss during repaint | `app-views/categories/document-editor/content/document.svelte:151`, `:157`, `:166`, `:248`, `:249`, `:356`, `:362` |
| Body label with copied Quote/Heading pixels | `app-views/categories/document-editor/procedures/editing.ts:36`, `:47`, `:72`, `:75`–`:79` |
| Detached page pins | `app-views/categories/document-editor/content/document.svelte:475`–`:482` |
| Cross-block comment truncation | `app-views/categories/document-editor/procedures/comments.ts:80`–`:103` |
| Source text and replies share one treatment | `app-views/general/comment/comment.svelte:155`–`:174` |
| Fractional Sections placement | `app-views/categories/document-editor/procedures/outline.ts:24`–`:31`, `:74` |
| Flattened furniture and page-number offset | `app-views/categories/document-editor/procedures/furniture.ts:22`–`:33`, `:44`–`:60` |
| Zero-value number field appears disabled | `components/authored/panel/panel-number.svelte:159`, `:168`; `components/vendored/input-group/input-group.svelte:18` |
| Immutable Quote/link styling and raw selected-node chrome | `app-views/categories/document-editor/content/document.svelte:748`, `:854`, `:860` |

## Main versus branch

`main` and `work/document-editor` have diverged by 2 and 7 commits respectively. The candidate is
78 changed files, about 8,064 additions and 1,355 deletions. A computed merge tree is currently
conflict-free, but that is not the same as being behaviorally safe.

| Concern | `main` | `work/document-editor` | Converged result |
| --- | --- | --- | --- |
| Document engine | Narrow projection; inspector controls are mostly mock state. | Live body, granular ops, real projection, persistence, runtime undo. | Branch engine. |
| Formatting row | Four controls; responsive initials/full words; fills the row. | Five word chips; wraps; Code added. | Main layout, branch handlers, no Code affordance. |
| Color picker | Inline popover mock with palette, eyedropper, Custom action; FG/BG share a row. | Real mark writes but two large swatch rows and repeat-change failure. | Extract main interaction into a real shared component and repair ops. |
| Links | URL + notes mock with note cards. | Real URL mark, notes removed. | Real URL + persisted notes. |
| Document rendering | Mostly plain paragraphs; does not render the full model. | Styles, marks, special blocks, furniture, annotations, pagination. | Branch projection after correctness and hard-coded-style fixes. |
| Header/footer | Absent. | Stored and repeated, but flattened and edited in inspector. | Branch model with on-page rich editing. |
| Tests | Existing unit/static coverage. | Expanded unit coverage; still no editor browser suite. | Both plus interaction tests that reproduce every P0/P1 path. |

The important lesson is not to choose one side wholesale. `main` held the intended interface as a
mock; the branch should have connected that interface to real operations rather than replacing it.

## Target inspector

### Text selection

1. Selection excerpt and character count remain at the top and remain highlighted in the document
   for as long as the inspector is acting on them.
2. Style select.
3. Font family gets the flexible width; font size is a compact input.
4. One four-cell formatting row: Bold / Italic / Underline / Strikethrough, falling back to B/I/U/S
   with a container query.
5. FG and BG compact color-picker triggers on one row.
6. **Body style**: four-way alignment followed by compact key/value numeric inputs for Space above,
   Space below, Line height, and Indent.
7. Comments and Links are clearly separated secondary sections.

### Color picker

- The trigger shows the current swatch and a disclosure arrow.
- The menu shows named theme/document colors, including None where valid.
- “Pick from screen” invokes `EyeDropper` when supported and explains when it is unavailable.
- “More colors…” opens the later custom-color view; that view supplies a visual field plus hex.
- FG and BG use the same component with different labels and allowed palettes.
- The value model must support both stable token references and validated custom colors.

### Comment thread

The order is deliberately unambiguous:

1. **Commented text** — a special, compact source block with “Show in document.”
2. Divider.
3. **Opening comment** — author, time, body; visually primary.
4. Replies — author, time, body; lighter but clearly threaded.
5. Reply composer and Resolve/Reopen.

### Layout

- Paper size, then one-row orientation.
- **Margins (in)** as four compact key/value fields without steppers.
- Header and Footer each show an enable switch and **Edit on page**.
- No From edge inputs.
- Page numbers show Position, Hide on first page, and First visible number. When hidden on the first
  page, the second page defaults to 1.

## Gesture contract

| Gesture | Result |
| --- | --- |
| Click | Place the caret. |
| Drag | Select one contiguous range. |
| Double-click | Select the word. |
| Shift-double-click | Select all text in the current block. |
| Ctrl/Cmd-drag | Add another range. |
| Ctrl/Cmd-click a link | Open the link; never select its text block. |
| Click an image/table | Inspect the object with product styling, not raw ProseMirror chrome. |
| Click outside the editor | Clear the document inspection. |

## Implementation sequence

### 0. Freeze the merge candidate

- Rebase the seven commits onto current `main` while the computed merge is clean.
- Preserve the seven-phase history or split follow-up work by behavior; do not squash correctness,
  interaction, and migration changes into one opaque commit.
- Record a clean seeded fixture for manual/browser tests instead of testing against mutated local
  document data.

### 1. Correctness spine

- Repair mark replacement ordering for color and links.
- Preserve held and multi-range selections across every projection/repaint.
- Define and implement next-style behavior on Enter; remove copied presentation from new blocks.
- Add link activation and text-block selection guards.
- Round/format section placement and add the favicon.

### 2. Shared panel primitives

- Restore the responsive full-row formatting control as the real `PanelMarks` behavior.
- Build one shared `PanelColorPicker` from the existing main-branch popover concept.
- Simplify `PanelNumber` to direct input + keyboard stepping and fix disabled-descendant opacity.
- Add a compact key/value row treatment and use container queries for labels that genuinely need
  abbreviation.

### 3. Inspector convergence

- Wire the repaired primitives into text-selection, next-letter, empty-line, and named-style lenses.
- Move alignment and spacing into Body style.
- Remove the Code affordance while retaining read compatibility.
- Remove immutable link and quote presentation.

### 4. Comments and links

- Add link notes to the representation, operations, validation, inverse, projection, and inspector.
- Recompose comment source/opener/replies.
- Move detached threads out of the page gutter.
- Decide and enforce the supported comment range model.

### 5. Furniture and layout

- Replace inspector mini-editors with on-page header/footer edit mode.
- Project complete furniture styling on every page.
- Remove From edge controls and correct first-visible page numbering.
- Compact orientation and margin rows.

### 6. Merge gate

- Typecheck, unit tests, architecture/style lint, and production build all green.
- Browser suite green at narrow, default, and expanded panel widths.
- Zero console errors, page errors, and unexpected failed requests.
- Manual review against a reset *Winter readiness brief* confirms the target mocks.

## Browser acceptance matrix

- Select text, click every inspector control, and confirm the same range remains visible.
- Add three non-contiguous ranges, change formatting, and confirm all three persist and update.
- Change FG ten times, BG ten times, alternate both, then undo/redo the full sequence.
- Add, edit, remove, re-add, undo, and Ctrl/Cmd-open a link with notes.
- Press Enter after Body, Heading 1–3, Quote, Caption, and Code content; data and pixels must agree on
  the next style.
- Verify Double-click and Shift-double-click against the gesture table.
- Create/open/reply/resolve/reopen a comment; delete its anchor and confirm it moves to Detached
  without a page pin.
- Open the Comments panel and confirm anchor text, opening comment, and replies cannot be confused.
- Resize context and inspector rails through their minimum, default, and maximum widths; four marks,
  FG/BG, and orientation stay on their required rows.
- Edit a styled header and footer on the page and verify every repeated instance renders identically.
- Hide the first page number and confirm page two begins at 1.
- Confirm Sections never shows fractional line text and long headings keep a usable title.
- Confirm a clean page load and every interaction above leave the console clean.

## Feedback ledger

Everything requested in the review is represented above:

- selection/highlight persistence;
- inspector actions not destroying the visible range;
- comment position and detached/floating comment behavior;
- comment source/opener/thread hierarchy;
- repeatable foreground/background colors;
- four formatting actions, no Code, responsive words/initials, full-row layout;
- shared color picker, same-row FG/BG, eyedropper, and future custom colors;
- Body style combining alignment and spacing;
- direct numeric inputs, clearer spacing labels, normal-looking zero values;
- link notes and editable link styling;
- no hard-coded quote bar;
- correct style continuation after Enter;
- compact font-size input and flexible font-family space;
- on-page rich header/footer editing and no From edge controls;
- first-visible page numbering behavior;
- Variables/Templates/Prompts retained as placeholders;
- stronger panel distinction and cleaner key/value composition;
- one-row orientation with responsive abbreviation;
- Sections repair;
- Ctrl/Cmd-open links, Double-click word, Shift-double-click block, no raw block outline;
- branch/main comparison, console cleanliness, regression coverage, and merge gates.
