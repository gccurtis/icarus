# Spreadsheet Capability — Design

## Summary

Spreadsheet is a **regular capability** (`3-capabilities/spreadsheet/`) that
owns editable workbook structure: sheets, stable rows and columns, sparse Cells,
formatting, formulas as source text, accepted cell values, merged-cell spans,
range projections, revisions, and calculation state.

Its canonical state is one workbook with ordered sheets, each containing stable
row and column axes and a sparse map of Cells. Structured values (tables,
records, lists) project from anchor Cells as deterministic range projections.

### Key design principles

**One Cell model for regular and merged Cells.** A `SpreadsheetCell` has a
stable ID, an anchor coordinate, and a rectangular `CellSpan`. A normal Cell
has a 1×1 span. A merged Cell has a larger span. Every coordinate covered by
a merged Cell resolves to the same Cell ID. Unmerging preserves the anchor
Cell and reduces its span to 1×1.

**Sparse storage.** An empty grid coordinate has no Cell record. Only
non-empty Cells are persisted.

**Range projections, not duplicate Cells.** When a Cell's source resolves to a
structured value (table, record, list), the result projects from the anchor Cell
as a range projection. Projected coordinates resolve to `(anchorCellId,
valuePath)` — they are not stored as independent Cells. A projection is blocked
if it would overlap a canonical Cell or merged span.

**Stable axes.** Rows and columns use stable IDs with sortable ranks. A1
notation is a projection of the current axis order, not the identity of a Cell.

```
WorkbookSnapshot
  ├─ title, metadata, calculation settings, revision
  ├─ ordered Sheet[]
  │    ├─ title, freeze state, defaults
  │    ├─ rows: { RowId → SheetRow (rank, height, hidden) }
  │    ├─ columns: { ColumnId → SheetColumn (rank, width, hidden) }
  │    ├─ cells: { CellId → SpreadsheetCell } (sparse)
  │    │    ├─ anchor (rowId, columnId)
  │    │    ├─ span (rowIds[], columnIds[])
  │    │    ├─ source: empty | literal | rich-text | formula | data | derived-output
  │    │    └─ accepted: scalar | rich-text | structured | error
  │    ├─ rules: SheetRule[]
  │    └─ overlays: SheetOverlay[]
  └─ (no themes — spreadsheet styling is per-cell)
```

### What it is not

Spreadsheet does **not** own:
- **Formula evaluation** — that is the Formula platform (`0-platform/formula/`).
  Spreadsheet stores formula source text and accepted evaluations.
- **Named values** — that is Structured Data (`3-capabilities/structured-data/`).
  Data owns all names (`variable`, `function`, `table`, `record`, `list`).
  Spreadsheet references Data entries by stable ID.
- **Rich Content** — that is the Rich Text platform (`0-platform/rich-text/`).
  Spreadsheet embeds `RichContent` in text-valued Cells.
- **Derived Outputs** — that is the Derived Outputs capability
  (`3-capabilities/derived-outputs/`). Spreadsheet holds `DerivedOutputRef`.

### Prerequisites

| Prerequisite | Spreadsheet dependency |
|---|---|
| Platform — Rich Text | Supplies `RichContent`, atoms, marks, operations. |
| Platform — Formula | Parses and evaluates formula source against a pinned Data binding view. |
| Capability — Structured Data | Owns all named values. Supplies Data binding view for formula name resolution and data-backed Cells. |
| Capability — Derived Outputs | Owns prompt definitions, retrieval, grounding, revisions, refresh. |
| Runtime config, database, job registry, dual queues, Logger | Constructs the scoped store, registers jobs, records structured outcomes. |

---

## Where it fits

```
User opens a Workbook
  → Frontend renders Sheet grid with Cell values
  → User edits a cell: sets literal value or formula source
  → Formula source: Spreadsheet sends to Formula.evaluate()
  → Formula resolves names via Data binding view
  → Spreadsheet stores accepted evaluation (scalar, structured, or error)
  → Structured result projects from anchor Cell as range projection

User inserts a Data-backed cell
  → Spreadsheet stores entryId + orientation
  → Frontend renders the projected range from the anchor Cell
  → User promotes a range to a Data entry: creates Data entry, replaces range with anchor Cell

User inserts a Derived Output cell
  → Spreadsheet stores DerivedOutputRef
  → Frontend reads the output revision and renders content
  → User refreshes: Spreadsheet calls DerivedOutputs.refresh(), adopts newer revision
```

---

## Where it lives

```
apps/backend/src/
  3-capabilities/
    spreadsheet/
      domain/
        model.ts           # all types: Workbook, Sheet, Cell, Range, Projection, operations
        errors.ts          # NotFound, RevisionConflict, ValidationError, etc.
        reducer.ts         # applyOperations (pure), computeTouchedIds, canRebase
        inverses.ts        # invertOperations (pure)
        validation.ts      # validateWorkbook, validateSheet, validateCell, validateSpan
        projection.ts      # buildRangeProjection, resolveCoordinate (pure)
      application/
        spreadsheetService.ts  # createSpreadsheetCapability factory
        commands.ts        # command dispatch: create, submit, duplicate, compensate
        queries.ts         # query dispatch: load, list, grid, history
        admission.ts       # CAS submit, idempotency, semantic rebase, ChangeSet append
        createService.ts   # create blank workbook
        readService.ts     # load snapshot, list workbooks, grid projection
        historyService.ts  # history listing, revision load
        calculation.ts     # plan → evaluate (concurrent) → settle (serial)
        derivedOutputRefresh.ts  # refresh derived output cell
        dataCoordination.ts     # attach data entry, promote range to data, materialize projection
        compensation.ts    # undo/redo via inverse operations
        activity.ts        # activity outbox contributions
        callLogging.ts     # structured logging wrapper
      ports/
        spreadsheetStore.ts  # SpreadsheetStore interface
      persistence/
        migrations/
          001-spreadsheet.ts
        sqliteSpreadsheetStore.ts
        sqliteMappers.ts
      index.ts

  1-init/create/
    spreadsheet.ts

  4-job-wiring/
    spreadsheet/
      registerSpreadsheetEndpoints.ts
      createSpreadsheetJobs.ts
```

---

## Files to read next

Read [canonical model](canonical-model.md) for the full type definitions (Workbook, Sheet, Cell, sources, projections).
Read [operations](operations.md) for the operation vocabulary, commands, queries, endpoints, and jobs.
Read [file architecture](file-architecture.md) for module responsibilities, dependency direction, and construction.
Read [store](store.md) for persistence, SQL schema, history retention, and compaction.