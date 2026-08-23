# Spreadsheet editor

## Purpose

The spreadsheet editor presents a sparse `SpreadsheetBody` as a fast grid with native Icarus block content and formula semantics. The vendor editor is an interaction/rendering adapter only: Icarus owns cells, blocks, formulas, merges, spills, analytic references, styles, named ranges, printing, change sets, and computation.

## Center surface

### Resource header

The fixed editor header shows editable spreadsheet title, template origin, truthful save/rebase/conflict and calculation state, and live collaborator presence only from an ephemeral presence channel. Rename is a metadata edit independent of grid changes.

### Workbook toolbar

- Undo/redo.
- Text/value formatting on persisted blocks.
- Alignment, borders, fill, value format, and named style where represented by the selected blocks.
- Merge/unmerge.
- Insert/delete rows and columns.
- Freeze panes.
- Create or place any compatible analytic component from the current selection; the analytic, nested chart/table, and internal parts have stable identity.
- Comment.
- Zoom and print preview.

Formatting a range applies only to existing selected blocks. Empty cells have no persisted cell/block on which to store fill, border, alignment, or value format; range styling of empty coordinates is gated on a model extension rather than silently materializing placeholder content. Soft wrap may be a renderer behavior, but there is no persisted wrap toggle.

### Name box and formula bar

- The name box shows the active A1 cell or selected range and accepts jump-to-cell/range input.
- The formula bar shows authored/raw cell content while the grid shows resolved/display content.
- It expands for multi-block or longer content and indicates the active block type.
- Formula state is fresh/stale/computing/error without replacing the last valid display when available.
- A spill child cell identifies its origin and is read-only until the spill is removed or changed.

### Grid

- Row and column headers provide selection, resize, insert/delete, and freeze cues.
- Only populated cells are persisted; empty visible cells are view coordinates.
- A cell's identity is its A1 address. Rows and columns are not identified model objects.
- Cells render one or more permitted text/formula blocks through the shared block renderer.
- Direct typing starts a text or formula edit according to content; double-click/F2 enters in-cell block editing. Escape returns from nested block edit to cell selection; F2 or an explicit Formula bar action transfers edit ownership to the formula bar; Enter commits and moves, while Escape cancels to the last accepted native value. IME composition is never committed mid-composition.
- Clipboard, fill, drag, and multi-cell operations remain one reviewable user action where practical.
- Merged ranges are visibly one editable region.
- Spill ranges show their generated boundary and block writes to occupied cells.
- Frozen rows/columns stay visible through scrolling.
- Floating analytic components remain anchored to a cell plus offsets and move with that anchor.

### Sheet tabs and status

- Sheet tabs sit along the bottom of the grid: add, rename, reorder, hide/unhide, and navigate.
- The current selection summary and calculation state sit in the status bar.
- Hidden sheets remain discoverable through the Sheets context view.

## Context panel

| Key | Label | Contents and organization |
| --- | --- | --- |
| `sheets` | Sheets | Default. Ordered sheet list, visibility, add/rename/reorder, current used extent, and freeze summary. |
| `data` | Data & names | Workbook named ranges followed by project Name Manager variables. Keep the two scopes visibly separate; functions are valid formula values but not Analysis inputs. |
| `find` | Find | Workbook search/replace with sheet and formula/display filters, result count, and virtualized navigation. |
| `dependencies` | Dependencies | Derived direct precedents/dependents for the selected formula and cycle/error diagnostics. This is computed, not a persisted graph. |
| `objects` | Objects | Identified floating analytic components by anchor, including overlapped items. Selecting a row addresses the same analytic and nested part IDs as the canvas and inspector. |
| `insert` | Insert | New analytic/chart kinds, existing saved analytics, text/formula content, and import-as-materialized-cells affordances. |
| `styles` | Styles | Default and named workbook styles, search, create, duplicate, rename. Local cell overrides remain in inspector. |
| `print` | Print | Page setup, area, repeating rows/columns, scale, gridlines, headings. Current sheet settings expanded. |
| `comments` | Comments | Workbook/current-sheet-derived/current-cell filters. Exact persisted anchors are workbook, cell, or text range only. |
| `context` | Context | Saved Resource Sets relevant to AI/import work and Open Context screen; they are not silently embedded in the workbook. |

## Inspector targets

| Selection | Expanded sections | Collapsed sections |
| --- | --- | --- |
| Workbook or nothing | Identity; quick sheet actions | Template provenance; attribution; diagnostics |
| Sheet | Name; used extent; frozen rows/columns; hidden state | Print setup; attribution |
| Cell | A1 identity; raw/display content; value state; format | Merge/spill membership; change attribution when derivable |
| Range | A1 range; shared formatting across existing blocks; aggregate summary | Empty-coordinate limitations; mixed-value details; named-range usage |
| Text block/text selection | Shared text inspector | Cell and sheet ancestry |
| Formula block | Raw formula; formatted display; typed value and state | Error; resolution time; dependency diagnostics if available |
| Row | Index; point height | Populated-cell summary |
| Column | Letter/index; point width | Populated-cell summary |
| Merge | Range; unmerge | Contained source cell |
| Spill | Origin formula; occupied range; read-only status | Current generated values |
| Analytic component | Analytic identity; output kind; materialization state | Anchor/offset/size; definition summary; change attribution when derivable |
| Chart or chart part | Type and type-specific formatting; selected mark/axis/element | Source provenance; analytic ancestry |
| Named range | Name; sheet; range | Usage |
| Project name | Authored/lookup name; declared type; stored value; definition order | Creator and updated time |
| Print setup | Page setup; area/repeats/scale | Gridline/headings flags |
| Named style | Identity and common style fields | Usage |
| Comment thread | State/body/replies | Cell/text anchor and attribution |

A range, row, or column can be a strong UI selection without pretending it has a persisted ID. Analytics are different: the analytic, component, chart/table, categories, series, datums, axes, added elements, table columns, rows, and cells all have semantic IDs. Retained selection and granular revisions therefore address model parts rather than array positions or SVG nodes.

Sheets, cells, analytic references, rows, and columns have no direct actor fields. Any nested attribution is derived from retained change sets and may be unavailable.

## Formula and block semantics

- Icarus's formula engine is the only calculation authority.
- A cell stores text and formula blocks, not an untyped vendor cell value.
- A text block may itself contain literal and formula atoms; the grid displays the resolved string while editing preserves raw atoms.
- A persisted formula block value is exactly empty, number, text, boolean, date, or a recursively nested table. Name Manager supports broader list/record/function declarations, but that does not widen `FormulaValue` without a model change.
- Spill occupancy is computed from the origin formula and persisted spill metadata; a write into the occupied range fails visibly.
- Dependency order and calculation graph are derived, not separately persisted.
- There is no pivot object; table-returning formulas and spills are the current native mechanism.

## Grid-library boundary

### Preferred candidate, with a required adapter spike

[Univer](https://github.com/dream-num/univer) is the preferred free/open-source candidate for grid rendering and interaction. Its open-source core is Apache-2.0 and its Sheets surface is the mature part of the suite. Use plugin mode, not a full preset, so Icarus can keep strict authority boundaries.

The current Univer view layer is React-based, although it documents Web Component and framework integration. In SvelteKit it must be mounted through a small imperative/custom-element adapter; React state must not escape into the application model.

### Allowed responsibilities

- Virtualized/canvas grid rendering.
- Pointer and keyboard selection.
- Row/column sizing and headers.
- Editing shell, clipboard, fill, scrolling, and viewport behavior.
- Command/event hooks that can be translated into Icarus operations.

### Excluded responsibilities

- Formula evaluation and formula truth.
- Collaboration/revision authority.
- Persistent workbook serialization.
- Import/export, printing, charts, pivots, or other commercial-only packages.
- Any internal object identity that replaces A1 cells or Icarus IDs.

Icarus must provide its own path for modelled features that Univer places in commercial packages. The adapter spike must demonstrate external-state projection, formula-engine bypass, command coverage, block-editor overlay, large sparse sheets, clipboard fidelity, Svelte lifecycle cleanup, and accessible selection. If it cannot, keep the vendor-neutral adapter contract and replace Univer without changing the screen or Convex model.

User, accepted-local, remote, formula-display, and viewport origins prevent subscription reconciliation from echoing as new outbound edits. The workbook runtime, grid instance, block editor, buffered operations, calculation state, and undo history survive tab view unmounting and release only on safe tab close.

## States and constraints

- Writes into spill cells fail with the origin/range identified.
- Merge conflicts and structural rebase failures preserve buffered local work.
- Formula errors remain attached to their raw formula and last display where available.
- Spreadsheet comments cannot truthfully anchor to a range, analytic component, row, column, or sheet under the current model; a sheet-filtered list is derived from cell anchors.
- The model contains no persisted sheet filters or sorts, so the first editor must not imply they will survive unless the model is extended.
- Row/column insertion and deletion require one native structural-rebase contract that updates populated A1 keys, formulas, comments, named ranges, merges, spills, analytic anchors, current selections, and Copilot range attachments atomically or rejects the operation with work preserved.
- Sheet tabs, selection status, and the final visible rows reserve the shared Copilot safe area.

## Deliberate navigation choices

- Find owns workbook search; Dependencies is a computed formula view; Objects owns analytic overlays.
- Project Name Manager access remains in Data & names.
- Rich History is deferred to change-set-derived attribution and project Activity.
- AI task navigation remains in Project Tasks and the Copilot Inspector.

## Retained tab view state

The `spreadsheet` state retains current sheet ID, A1 range selection, row/column viewport anchor with offsets, zoom, Formula bar expansion, Find query, and panel state. The Univer instance, nested block editor, calculation buffers, mapped selection, undo history, and pending operations stay in the tab runtime. Reload validates the sheet and range against current extents, then falls back to the first visible sheet and `A1` when needed.

## Model coverage

- [Spreadsheet](../data-models/general-resources/spreadsheet.md)
- [Content blocks](../data-models/content/content-block.md)
- [Name Manager](../data-models/data/name-manager.md)
- [Styles](../data-models/general-resources/style-set.md)
- [Page setup](../data-models/general-resources/page-setup.md)
- [Comments](../data-models/collaboration/comment.md)
