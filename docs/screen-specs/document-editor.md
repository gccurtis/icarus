# Document editor

## Purpose

The document editor presents Icarus's native `DocumentBody` as a paginated writing surface. It uses ProseMirror for editing behavior, selection, input handling, and rich-text commands, but the native rows, blocks, atoms, marks, styles, and change sets remain authoritative.

## Center surface

### Resource header

The fixed editor header shows editable document title, template-origin indicator, truthful save/rebase/conflict state, and live collaborator presence only when an ephemeral presence channel exists. Rename commits independently of body editing. The header never infers presence from `lastSeenAt`.

### Local toolbar

The compact toolbar stays above the scrolling page field and contains:

- Undo/redo with user-local scope.
- Named style and text variant.
- Bold, italic, underline, strike, code, text color, and link.
- Block alignment and list/checklist controls supported by the native block fields.
- Insert menu for every supported block/row type.
- Comment on an exact text selection, or on the whole document when no legal text anchor exists.
- Zoom and page-width controls at the far end.

Controls reflect the current selection. Mixed values show a mixed state. Font family, font size, indentation, and line spacing live on named `TextStyle`, not direct marks/block formatting; changing them edits or creates a named style instead of pretending they are selection-local overrides. Less common block and page properties remain in the inspector.

When a code block is selected, marks, links, and formula-atom insertion are disabled: a code block contains exactly one literal atom and no marks.

### Page field

- Pages are centered on a neutral pasteboard with visible paper boundaries and consistent inter-page gaps.
- The sticky horizontal ruler across the top and vertical ruler at left use points projected through current zoom. A separate page-margin gutter and inner block-handle lane avoid assigning three interactions to one strip; the ruler corner identifies their meeting point.
- Rulers show page edges, margins, indents, column boundaries for a multi-block row, and draggable guides where the model supports a persisted value.
- Header and footer regions are visible on hover/focus and editable in place.
- First-page furniture is used when configured.
- Page numbers are generated from page-number settings, not typed content.
- Current page, page count, word/character count, and zoom appear in the status bar.

Natural pagination is computed from page setup and laid-out content. It is never written as `pageBreak` rows. An explicit user break is a visible, selectable `pageBreak` row and persists.

Caret movement and text selection cross computed page boundaries as one logical ProseMirror flow. Reflow anchors the viewport to the nearest stable block ID and caret position rather than a page number that may change. Entering header/footer furniture uses an explicit focus action; Escape or Move to body returns to the nearest body position.

### Row and block behavior

- A blocks row may contain one or more side-by-side blocks with editable proportions.
- Enter at the end of a text block creates another block/row; persisted text blocks do not contain newlines.
- Divider and page-break rows have visible selection affordances without dominating reading mode.
- Block drag handles appear in the left content gutter on hover/focus and have keyboard Move before/after equivalents.
- The insert affordance appears between rows and in the inspector's empty-selection state.
- Text, image, table, embed, formula, and prompt blocks all use the shared `ContentBlock` renderer and inspector.
- Plain hyperlinks remain text marks. Rich link cards, video, and app frames are embed blocks.

### Raw and displayed content

A text block displays its resolved string while retaining authored atoms:

- Literal atoms edit as text.
- Formula atoms appear inline as atomic resolved spans with fresh/stale/computing/error state.
- Marks are applied against UTF-16 offsets in the displayed string.
- Selecting a formula atom exposes its raw expression and displayed value without replacing one with the other.

A formula block similarly shows its formatted display in the page and its raw expression, typed value, state, error, and resolution time in the inspector.

## Context panel

| Key | Label | Contents and organization |
| --- | --- | --- |
| `navigator` | Navigator | Default. Outline and Pages are two switchable/independently virtualized subsections rather than one unbounded list. Current heading/page highlighted; explicit breaks and header/footer entry points are secondary rows. |
| `find` | Find | Search and optional replace, result count, current-result navigation, and grouped snippets. Replace obeys viewer/read-only state and native block boundaries. |
| `insert` | Insert | Text variants; image, table, embed, formula, prompt; divider, explicit page break, and side-by-side row. Groups are collapsible; Basics starts expanded. |
| `styles` | Styles | Default and named styles, search, create, rename, duplicate. Selected style expanded; local overrides remain in the inspector. |
| `page` | Page | Paper, orientation, margins, header/footer, first-page variants, and page numbering. Page setup sections start expanded; advanced furniture sections collapse. |
| `comments` | Comments | Open first, resolved collapsed. Filter by document, computed current page, or exact text selection. Selecting a thread navigates to its legal document/text anchor. |
| `context` | Context | Saved Resource Sets available to prompt blocks and the copilot; resolved-member preview and Open Context screen. |

## Inspector targets

| Selection | Expanded sections | Collapsed sections |
| --- | --- | --- |
| Document or nothing | Identity; quick Insert | Template provenance; created/updated attribution; document diagnostics |
| Page background | Page setup | Header/footer; page-number settings; computed page diagnostics |
| Header or footer | Furniture identity; spacing | First-page variant; page numbering |
| Blocks row | Layout and proportions | Row diagnostics |
| Divider row | Line style | Placement; change attribution when derivable |
| Explicit page break | Break identity and remove/move | Change attribution when derivable |
| Next text/caret | Text style to apply; paragraph variant | Current named style and overrides |
| Text selection | Marks and link; text style | Raw/display offset diagnostics |
| Text block | Variant and variant-specific fields; block format | Atoms; change attribution when derivable |
| Formula atom | Raw expression; displayed value and state | Error/resolution timing; offset mapping |
| Formula block | Raw expression; display; typed value and state | Format; error; resolution timing |
| Image | Source/preview; alt text; dimensions/crop | Caption; normalized display metadata; change attribution when derivable |
| Table | Size/header rows/column widths | Nested structure; change attribution when derivable |
| Table cell | Spans; content blocks; cell format | Parent table |
| Table range or multi-block selection | Shared applicable properties; selection count | Mixed/unsupported properties and ancestry |
| Link mark | URL and displayed text | Mark range and open/copy actions |
| Embed | URL and presentation | Cached title/description/image and fetch age |
| Prompt block | Prompt; displayed output; refresh/state | Scope; derived-output provenance; inputs and lattice version |
| Named style | Identity; typography; spacing | Alignment/indent; usage |
| Comment thread | State and body; replies | Anchor details; mentions; attribution |

Inspector breadcrumbs retain ancestry, such as Document → Table → Cell → Text selection. A computed page may be described as “Page 3,” but it is not treated as a persisted object with its own ID.

Rows, blocks, atoms, and nested objects have no direct actor fields. Any subobject attribution shown here is a derived view over retained change sets and may be unavailable; it is not ordinary object metadata.

## ProseMirror boundary

### Chosen role

[ProseMirror](https://prosemirror.net/) is the editing engine, not the storage model or collaboration authority. Its custom-schema and transaction model fit the required adapter, and its core is MIT-licensed. Icarus should use the core packages directly so the native model boundary stays explicit.

### Projection into editor state

The adapter projects one native body into a custom schema resembling:

```text
document
  blocks-row
    text-block | image-block | table-block | embed-block | formula-block | prompt-block
  divider-row
  explicit-page-break-row
```

Each identified node carries the stable resource-local Icarus ID needed to map selections and changes. Formula atoms are inline atom nodes whose attributes retain the raw expression and whose view renders the resolved value/state. The adapter must not flatten raw atoms into one string or persist ProseMirror JSON.

Header/footer `rows` and `firstPageRows` are separate furniture roots, not part of the body flow. Each native furniture path has at most one active canonical ProseMirror editor. Its repeated appearances on computed pages are read-only projections of that same state; activating any appearance focuses or positions the one canonical editor rather than mounting independently editable clones. Updates repaint every repeated projection. Every emitted operation names body, header rows, first-page header rows, footer rows, or first-page footer rows explicitly, so repeated furniture cannot race or echo edits.

### Transactions to native change sets

1. ProseMirror receives input and emits a transaction.
2. The adapter compares the affected identified rows/blocks and produces granular native operations.
3. Local operations are coalesced into an Icarus change set and submitted to Convex.
4. Convex subscriptions deliver accepted local and remote change sets.
5. The adapter applies them back to editor state while mapping the current selection by stable IDs.

Transactions carry an origin such as user, accepted-local, remote, formula-display, or layout-only. Only user-origin transactions become outbound operations; accepted subscriptions and display refreshes cannot echo into another change set. Remote reconciliation and formula-display refreshes are not entered into the user's ProseMirror undo history. ProseMirror's collaboration plugin, Yjs, and any second authoritative revision protocol are out of scope because Icarus change sets already own collaboration.

### Pagination and rulers

Pagination is a view/layout layer around the editor:

- ProseMirror retains one logical document flow.
- Page measurements, decorations, and furniture project computed page boundaries.
- Reflow after font/image/layout changes recomputes boundaries without creating transactions.
- Only an explicit break maps to a persisted page-break row.
- Ruler gestures emit native page/row/style operations only when the dragged value exists in the model.

This prevents zoom, viewport width, or browser font timing from creating collaborative document churn.

## Deliberate navigation choices

- Find is a document context view.
- Project Name Manager values are reached from formula/prompt inspection and the Spreadsheet/Analysis data surfaces, not duplicated as a document navigator.
- References and provenance are reached from the selected link/embed/formula/prompt/source inspector.
- A rich History lens is deferred; change-set-derived attribution may appear in inspection and project Activity, but the screen does not promise a revision browser.
- AI task history remains in the Project Tasks view and Copilot Inspector rather than another document rail icon.

## Shared editing and failure states

- Saving, saved, rebasing, needs review, offline, and error use the [shared shell language](workbench-shell.md#shared-synchronization-states).
- A rejected operation keeps buffered text and offers Reapply after refresh.
- Image and embed loading errors preserve the block and its editable source fields.
- Stale or errored prompt/formula blocks continue to show their last display when available, with state clearly attached.
- Viewer and archived modes preserve selection/copy/comment reading but disable mutation.

## Retained tab view state

The `document` state retains active context and panel geometry, zoom, a stable-block scroll anchor, a native root/block/offset selection bookmark, and Find query. The live ProseMirror views, canonical furniture editors, mapped selection, undo history, IME composition, and pending operations stay in the tab runtime rather than serialized state. On reload, restore the nearest valid block anchor and clear an invalid or composition-local selection.

## Model coverage

- [Document](../data-models/general-resources/document.md)
- [Content blocks](../data-models/content/content-block.md)
- [Page setup](../data-models/general-resources/page-setup.md)
- [Styles](../data-models/general-resources/style-set.md)
- [Comments](../data-models/collaboration/comment.md)
- [Change sets](../data-models/revisions/change-set.md)
