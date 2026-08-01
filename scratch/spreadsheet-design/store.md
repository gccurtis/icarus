# Spreadsheet capability — store and history

## Project-scoped runtime

Like all capabilities, Spreadsheet is constructed with a store already scoped
to one project. Project and user IDs are not domain fields, ChangeSet fields,
or method parameters.

```ts
interface SpreadsheetDependencies {
  richText: RichText;
  formula: FormulaEngine;
  structuredData: StructuredData;
  derivedOutputs: DerivedOutputs;
  logger: Logger;
}

const store = new SQLiteSpreadsheetStore(projectId, db);
const spreadsheet = createSpreadsheetCapability(store, deps, options);
```

The request/runtime layer resolves the project before it calls this object.
SQLite table names are derived from the project ID using SHA-256 prefixing.

## Base plus ChangeSet history

The `spreadsheet_workbooks` row holds current head metadata and the active
`baseSeq`. A Base is a materialized Workbook snapshot at a specific revision.

```text
head: revision 42, baseSeq 30

Base[30] ── apply ChangeSets 31…42 ──> snapshot[42]
```

Creation is revision `0`: one initial Base (a workbook with one sheet, default
row and column axes, no cells) and no ChangeSet.

```ts
interface SpreadsheetBase {
  representationVersion: 1;
  workbookId: string;
  baseSeq: number;
  snapshot: WorkbookSnapshot;   // complete snapshot at this seq
  semanticDigest: string;
  createdAt: string;
}
```

Base contains the complete `WorkbookSnapshot` — title, sheets, axes, cells,
rules, overlays, metadata, and calculation settings.

## Store port

```ts
interface SpreadsheetStore {
  // ── Heads ─────────────────────────────────────────────────────────────
  listHeads(cursor?: string, lifecycle?: WorkbookHead["lifecycle"]): Promise<WorkbookPage>;
  getHead(workbookId: string): Promise<WorkbookHead | undefined>;

  // ── Snapshots ─────────────────────────────────────────────────────────
  load(workbookId: string, revision?: number): Promise<WorkbookSnapshot | undefined>;

  // ── History ───────────────────────────────────────────────────────────
  getChangeSets(
    workbookId: string,
    fromExclusive: number,
    toInclusive: number
  ): Promise<SpreadsheetChangeSet[]>;

  // ── Idempotency ───────────────────────────────────────────────────────
  getSubmission(
    workbookId: string,
    clientRequestId: string
  ): Promise<SpreadsheetSubmissionReceipt | undefined>;

  // ── Mutation ──────────────────────────────────────────────────────────
  /** Atomic: persist head update, ChangeSet, receipt, and activity outbox. */
  commitMutation(commit: SpreadsheetMutationCommit): Promise<void>;

  // ── Compaction ────────────────────────────────────────────────────────
  appendBase(workbookId: string, base: SpreadsheetBase): Promise<void>;
  pruneBases(workbookId: string, retain: number): Promise<void>;
  pruneChangeSets(workbookId: string, retain: number): Promise<void>;
}
```

## SQL schema

```sql
CREATE TABLE spreadsheet_workbooks (
  id               TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  lifecycle        TEXT NOT NULL CHECK (lifecycle IN ('active', 'archived', 'trashed')),
  revision         INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  base_seq         INTEGER NOT NULL DEFAULT 0 CHECK (base_seq >= 0),
  semantic_digest  TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE INDEX spreadsheet_workbooks_lifecycle_updated
  ON spreadsheet_workbooks(lifecycle, updated_at DESC, id);

CREATE TABLE spreadsheet_command_receipts (
  request_id      TEXT PRIMARY KEY,
  request_digest  TEXT NOT NULL,
  result_type     TEXT NOT NULL,
  result_json     BLOB NOT NULL,
  created_at      TEXT NOT NULL
);

CREATE TABLE spreadsheet_bases (
  workbook_id             TEXT NOT NULL,
  base_seq                INTEGER NOT NULL CHECK (base_seq >= 0),
  representation_version  INTEGER NOT NULL,
  snapshot_json           BLOB NOT NULL,
  semantic_digest         TEXT NOT NULL,
  created_at              TEXT NOT NULL,
  PRIMARY KEY (workbook_id, base_seq),
  FOREIGN KEY (workbook_id) REFERENCES spreadsheet_workbooks(id) ON DELETE CASCADE
);

CREATE INDEX spreadsheet_bases_lookup
  ON spreadsheet_bases(workbook_id, base_seq DESC);

CREATE TABLE spreadsheet_change_sets (
  id                                 TEXT PRIMARY KEY,
  workbook_id                        TEXT NOT NULL,
  client_request_id                  TEXT NOT NULL,
  request_digest                     TEXT NOT NULL,
  authored_revision                  INTEGER NOT NULL CHECK (authored_revision >= 0),
  prior_revision                     INTEGER NOT NULL CHECK (prior_revision >= 0),
  revision                           INTEGER NOT NULL CHECK (revision > 0),
  seq                                INTEGER NOT NULL CHECK (seq > 0),
  origin                             TEXT NOT NULL CHECK (origin IN ('interactive', 'agent', 'automation')),
  operations_json                    BLOB NOT NULL,
  inverse_operations_json            BLOB NOT NULL,
  touched_ids_json                   BLOB NOT NULL,
  compensation_intent                TEXT CHECK (compensation_intent IN ('undo', 'redo')),
  compensation_target_change_set_id  TEXT,
  semantic_digest                    TEXT NOT NULL,
  created_at                         TEXT NOT NULL,
  UNIQUE (workbook_id, seq),
  UNIQUE (workbook_id, revision),
  FOREIGN KEY (workbook_id) REFERENCES spreadsheet_workbooks(id) ON DELETE CASCADE,
  FOREIGN KEY (compensation_target_change_set_id)
    REFERENCES spreadsheet_change_sets(id)
);

CREATE INDEX spreadsheet_changes_recent
  ON spreadsheet_change_sets(workbook_id, seq DESC);

CREATE INDEX spreadsheet_changes_compensation_target
  ON spreadsheet_change_sets(compensation_target_change_set_id)
  WHERE compensation_target_change_set_id IS NOT NULL;

CREATE TABLE spreadsheet_activity_outbox (
  id               TEXT PRIMARY KEY,
  workbook_id      TEXT NOT NULL,
  revision         INTEGER NOT NULL CHECK (revision >= 0),
  change_set_id    TEXT,
  actor_id         TEXT NOT NULL,
  operation_type   TEXT NOT NULL,
  payload_json     BLOB NOT NULL,
  semantic_digest  TEXT NOT NULL,
  occurred_at      TEXT NOT NULL,
  published_at     TEXT,
  UNIQUE (workbook_id, revision),
  FOREIGN KEY (workbook_id) REFERENCES spreadsheet_workbooks(id) ON DELETE CASCADE,
  FOREIGN KEY (change_set_id) REFERENCES spreadsheet_change_sets(id)
);

CREATE INDEX spreadsheet_activity_unpublished
  ON spreadsheet_activity_outbox(occurred_at, id)
  WHERE published_at IS NULL;
```

Canonical JSON uses deterministic key ordering and a SHA-256 semantic digest.

### No normalized projection tables

Unlike the old design, there are no `spreadsheet_base_sheets`,
`spreadsheet_base_rows`, `spreadsheet_base_columns`, or
`spreadsheet_base_cells` tables. The immutable Base blob contains the complete
`WorkbookSnapshot`. Current-base read optimization is an implementation detail
of the SQLite store.

### No rebuildable calculation index tables

The old design had `spreadsheet_dependency_index` and
`spreadsheet_projection_index` tables. These are rebuildable read projections
that can be added as an implementation optimization but are not canonical state.
They are computed from the immutable workbook revision and can be rebuilt at
any time.

## History retention

```ts
interface SpreadsheetHistoryRetention {
  retainedBaseCount: number;       // default: 5
  retainedChangeSetCount: number;  // default: 1000
}
```

A revision loads only when a retained Base exists at or before it and the needed
ChangeSet tail is continuous. Otherwise returns `history_pruned`.

## Compaction

Compaction runs on the serial queue:

1. Load and replay the exact current head.
2. Append a new Base at that revision.
3. Advance active `baseSeq` only when the head revision remains unchanged.
4. Prune Bases and ChangeSets beyond the configured retention counts, keeping
   the tail required for current-head replay.

Compaction changes neither logical revision nor semantic digest.

## Sparse storage

Only non-empty Cells are persisted. An empty grid coordinate has no row in the
snapshot. This is critical for spreadsheet scale — a sheet might have a million
rows and 16K columns but only a few hundred thousand actual Cells.

The Base blob stores Cells as a sparse `Record<CellId, SpreadsheetCell>`. The
SQLite store does not create rows for empty coordinates. Axis definitions
(rows and columns) are present even when empty — they define the grid structure.

## Merged cell span storage

A merged Cell's span is stored as the `rowIds[]` and `columnIds[]` arrays in
the `CellSpan`. The SQLite store serializes this into the snapshot JSON BLOB.
There is no separate span table — spans are part of the Cell object.

When loading a workbook, the span is validated:
- Rectangular under current axis order
- Contiguous (no gaps)
- Anchored at `(span.rowIds[0], span.columnIds[0]) === anchor`
- No overlap with any other Cell's span

## Canonical and operational state

| Canonical Workbook state | Operational / rebuildable state |
|---|---|
| title, lifecycle, revision | workspace summary |
| sheetOrder | — |
| sheet titles, freeze, defaults | — |
| rows (id, rank, height, hidden) | row count, visible count |
| columns (id, rank, width, hidden) | column count, visible count |
| cells (sparse) | cell count, formula count, data-backed count |
| cell sources (formula, data, derived-output) | dependency graph, calculation plan |
| cell spans (merge/unmerge) | merged region map |
| accepted cell content (scalar, rich-text, structured, error) | grid projection, coordinate resolution |
| range projections | projection index (rebuildable) |
| rules, overlays | — |
| calculation settings | — |
| Base and ChangeSets | compaction schedule |
| Activity outbox rows | structured logs |