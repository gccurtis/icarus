# 0048 Horizontal Row tracks

This increment completes roadmap R6. Rows now carry an ordered track list that
defines proportional weights, trailing gaps, and minimum widths for horizontal
block layout. Two new change operations allow atomic track assignment and
adjacent weight adjustment. Block movement between rows normalizes tracks in
both the source and target row, and legacy multi-block rows without tracks
receive equal-weight defaults during normalization.

## `core/capability/document/track.go`

### Add the track model, constants, validation, normalization, and clone helpers

```go
type Track struct {
	BlockID  string     `json:"blockId"`
	Weight   int        `json:"weight"`
	Gap      LayoutUnit `json:"gap"`
	MinWidth LayoutUnit `json:"minWidth"`
}
```

Define the `Track` type, bounded constants (weight 1-1000, gap 0-288pt), and
the `validTracks`, `normalizeRowTracks`, `defaultTracks`, and `cloneTracks`
helpers. Integer weights keep proportional division deterministic across
renderers.

The goal is to give every multi-block row a canonical horizontal layout recipe
without changing the existing Row/Block/Atom aggregate shape.

## `core/capability/document/track.go.md`

### Mirror the new track source verbatim

Add the required companion for the new file.

## `core/capability/document/document.go`

### Add Tracks to Row

```go
type Row struct {
	ID     string   `json:"id"`
	Style  RowStyle `json:"style"`
	Tracks []Track  `json:"tracks,omitempty"`
	Blocks []Block  `json:"blocks"`
}
```

A Row now carries an optional ordered Track list. Tracks are present on
multi-block rows and nil on single-block rows, keeping the JSON compact.

## `core/capability/document/changeset.go`

### Add horizontal-track change operations

```go
OpSetRowTracks         OpType = "set_row_tracks"
OpResizeAdjacentTracks OpType = "resize_adjacent_tracks"
```

Add `OpSetRowTracks` to atomically replace a row's track list (validates block
identity, weight, gap, and min-width bounds) and `OpResizeAdjacentTracks` to
adjust the weight boundary between two adjacent blocks in a single operation.
Both participate in validation, apply, server-computed inverse generation,
and clone.

### Add Track and DeltaWeight fields to ChangeOp

```go
Tracks      []Track `json:"tracks,omitempty"`
DeltaWeight int     `json:"deltaWeight,omitempty"`
```

### Normalize tracks on block insert, delete, and row insert

`OpInsertRow` now normalizes the inserted row's tracks. `OpInsertBlock` and
`OpDeleteBlock` call `normalizeRowTracks` to repair the affected row's track
state after the block-count changes — generating or removing tracks as needed.

## `core/capability/document/editing.go`

### Normalize tracks during block movement

```go
normalizeRowTracks(&rows[sourceRow])
if sourceRow != targetRow {
	normalizeRowTracks(&rows[rowIndex(rows, op.RowID)])
}
```

When `OpMoveBlock` moves a block, the source row may lose or gain a block
(within-row reorder keeps the block count stable). The source row's tracks are
always normalized; when the target row differs, its tracks are normalized too.
This ensures block movement preserves valid horizontal layout.

## `core/capability/document/layout.go`

### Normalize legacy rows during base restoration

`normalizeStoredBase` now calls `normalizeRowTracks` for every row. Legacy
multi-block rows without tracks receive equal-weight defaults, and
single-block rows have their tracks cleared. This is a read-time
normalization; the first rebase persists the normalized tracks.

## `core/capability/document/history.go`

### Include track operations in history summaries

`OpSetRowTracks` and `OpResizeAdjacentTracks` are marked as document-wide in
`SummarizeChangeOps`, since adjusting a row's horizontal layout can affect
how multiple blocks render.

## Companion docs

Updated `document.go.md`, `changeset.go.md`, `layout.go.md`, `editing.go.md`,
and `history.go.md` to match the new source.

## Directives

- [x] Stable Document, Row, Block, Atom, and Mark identities unchanged.
- [x] Track data stored as typed structs on Row, not as untyped JSON.
- [x] Both new operations validated, inverted, and summarized.
- [x] Block movement composes with track normalization.
- [x] Legacy documents normalized on read.
- [x] Companion docs updated.
- [x] All tests pass.

## Follow-up: Block line height and font map

R6 follow-up that moved vertical spacing from row level to block level and
added a deterministic character-width font map.

### Remove row-level height control

`RowStyle.HeightIncrease` and `MaxHeightIncrease` are removed. Row spacing
is now purely config-determined via `LayoutRules.MinRowPadding` — a document
creation-time snapshot from server config, never mutable per-row.
`OpSetRowHeight` is removed.

### Add block-level line height

`BlockStyle` gains a `LineHeight` field (0-128pt, 0 means inherit
`LayoutRules.MaxFontHeight`). `OpSetBlockLineHeight` replaces the old
`OpSetRowHeight`, with full validation, apply, inverse, clone, rebase
footprint, and history summary support.

### Add character-width font map

`LayoutRules` gains a `CharWidth` field — the fixed per-character advance
width used for deterministic line-breaking. The default is 8pt. This
provides a renderer-independent basis for computing how many characters fit
in a block of a given tracked width.

### Paginate from block line heights

`Paginate()` now derives row height from the tallest block's effective line
height plus config-determined `MinRowPadding`, rather than a fixed baseline
plus per-row `HeightIncrease`. A `rowHeight()` helper caps each row at the
max block line height in that row.

### Config and wiring

`DocumentLayout` in server config replaces `max_row_height_increase` with
`char_width`. The `wiring` layer and the default `config.yaml` are updated
accordingly.

## Follow-up: Header, Footer, and page flow (R7)

### Add recurring Header and Footer regions to Base

`Base` gains `Header []Row` and `Footer []Row` fields. These use ordinary
Rows/Blocks/Atoms rather than a separate content model. They participate in
clone, validation, and content integrity checks.

### Add page-break and keep-with-next to RowStyle

`RowStyle` gains `PageBreak bool` and `KeepWithNext bool`. PageBreak forces
a page break before the row. KeepWithNext pulls the previous row to a new
page when the current row overflows — the common case for keeping headings
with their content.

### Add set_row_flow, set_header, set_footer operations

Three new typed ChangeOps:
- `OpSetRowFlow` — set a row's PageBreak and/or KeepWithNext flags
- `OpSetHeader` — replace the document's header rows  
- `OpSetFooter` — replace the document's footer rows

All three participate in validation, apply, inverse, clone, rebase footprint,
and history summary. Row IDs in header/footer payloads are auto-assigned.

### Update Paginate for headers, footers, and flow

`Paginate()` now subtracts header and footer height from the usable content
area. A `PageBreak` row starts a new page (unless it's already the first
row). `KeepWithNext` on a row that wouldn't fit pulls the previous row to
the new page alongside it. The `rowsHeight()`, `prevRowKeepNext()`, and
`rowByID()` helpers support the new logic.

### Fix cloneRows nil-preservation

`cloneRows` now returns nil for an empty input, so `omitempty` JSON tags
work correctly and bases compare equal after roundtrip through clone.

## Follow-up: Pagination policy v2 (R8)

### Add PolicyVersion to LayoutRules

`LayoutRules` gains a `PolicyVersion` field. New documents are created with
`PaginatePolicyV2` (value 2); legacy documents keep their existing version (0
or 1), so existing content is not silently repaginated. The policy version
travels with the document like the other LayoutRules.

### Text-wrapping block height computation

`blockContentHeight()` computes a block's rendered height from its display
text, line height, block width, and `CharWidth`. It counts runes, divides by
characters-per-line (block width ÷ char width), and multiplies by the
block's effective line height. Empty blocks are one line tall.

### Track-aware block widths

`blockTrackWidth()` derives a block's horizontal span from its row's tracks.
For single-block rows or rows without tracks the block gets the full content
width. For tracked rows, each block's width is computed from its weight
proportion of the available space (content width minus total track gaps).

### Version-gated row height

`rowHeight()` dispatches between `legacyRowHeight` (v0/v1 — single-line per
block, max block line height) and `v2RowHeight` (v2 — wrapping-aware with
track widths). The v2 path calls `blockTrackWidth()` and
`blockContentHeight()` for each block.

### Updated Paginate and helpers

`Paginate()` computes `contentWidth` from page geometry and passes it to
`rowHeight()` and `rowsHeight()`. Headers, footers, page breaks, and
keep-with-next continue from R7. The result is that blocks with text too
long for their track width wrap to multiple lines, producing taller rows and
fewer rows per page — all deterministically from canonical data.

## Follow-up: Formula atom payload (R9)

### Add AtomData interface and FormulaData type

`Atom` gains a `Data AtomData` field. `AtomKindFormula` is the first non-text
atom kind. `FormulaData` carries the expression, latest `Result`/`State`
(denormalized from history), `Dependencies`, and an append-only
`History []FormulaHistoryEntry`. Each history entry records the result,
dependencies, state, and wall-clock time of one evaluation.

### Add OpSetAtomFormula and OpRefreshFormula

`OpSetAtomFormula` sets an atom's formula data. `OpRefreshFormula`
re-evaluates using the existing expression (or an updated one from the
payload). Evaluation runs inline during submission via `evaluateFormulaOps`,
which calls the `FormulaEvaluator` port, populates the result and
dependencies, and sets the state to `ok` or `error`. The apply step appends
a `FormulaHistoryEntry`. Both operations participate in validation, apply,
inverse, clone, rebase footprint, and history summary. The inverse restores
the previous `FormulaData`.

### Add FormulaEvaluator port

`FormulaEvaluator` is a narrow port wired into `Documents` through
`Options`. When nil, formula operations are rejected. The port keeps the
document capability free of evaluation logic.

### Deep-copy atom data

`cloneAtoms` and `cloneAtomData` deep-copy `FormulaData` including
dependencies and history slices. `Atom.UnmarshalJSON` decodes the `Data`
payload from the atom's declared `Kind`.

## Follow-up: Block catalog (R11)

### New block kinds

Six new block kind constants:
- `quote` — blockquote, text-bearing
- `code` — monospace preformatted, text-bearing
- `divider` — horizontal rule, no atoms
- `callout` — highlighted box, text-bearing
- `list_item` — bullet/ordered/check item, text-bearing, carries `ListData`
- `image` — image block, no atoms, carries `ImageData`

All six are admitted by `blockKinds` and `validBlockKind`. No new change
operations needed — they are inserted with the existing `OpInsertBlock`.

### List data

`ListData` carries the list marker type (`bullet`, `ordered`, `check`), a
nesting level, a checked flag (for check lists), and an ordinal counter (for
ordered lists). Consecutive `list_item` blocks of the same type and level
form a list boundary; a level or type change starts a new list. No container
block — the flat Row model stays intact.

### Image data

`ImageData` holds a `FileID` (exact file identity), `Alt` text, and display
`Width`/`Height` in typographic points. The renderer resolves the file bytes.
The dimensions feed pagination for row height computation.

### What's deferred

Tables (needs cell nesting and rectangular validation), embeds (needs
provider snapshots), and equation/chart/metric blocks (depend on formula
evaluation being wired end-to-end).

### Formula history (R9 extension)

`FormulaData` gains `History []FormulaHistoryEntry`. `OpSetAtomFormula`
creates the first entry; `OpRefreshFormula` appends. The latest `Result`
and `State` are denormalized for quick access. No `LastGood` pointer — the
full history is preserved.

### Prompt output history

`PromptData` gains `OutputHistory []PromptOutputRevision`. Each revision
holds immutable atoms and marks plus a creation timestamp.
`OpResolveBlock` now appends a new revision instead of overwriting atoms
in-place, carrying forward existing history and the incoming resolution
metadata. The block's `Atoms`/`Marks` reflect the latest revision.

`OpRestorePromptOutput(revisionId)` copies a past revision's content into a
new history entry and updates the block's display atoms/marks. The inverse
of both resolve and restore appends another entry (the prior state).

### What's not present

No `currentOutputId` pointer — the latest history entry is always current.
No proposal-vs-direct distinction — every resolution appends.
No auto-detection of user edits between resolutions.
