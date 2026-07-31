# Capability — Icarus Data Runtime Model

> Mirrored from [Notion](https://app.notion.com/p/3aeb6410e502810baa01d94f958c44a9).

## Summary / Concept
> **Build position — Foundations 4.** Data follows Intelligence, Context, and Formula. It gives later resource and research capabilities one authority for stable names, typed variables, typed tables, exact value snapshots, and set-based queries.
<callout icon="🧭" color="blue_bg">
	**Provisional consolidation boundary.** Data combines the proven Name Manager and Structured Data responsibilities behind one capability. The internal split between the declaration catalog and structured-value aggregate is deliberate: one folder and public port do not require unrelated mutations to share a revision clock. Endpoint naming and internal file granularity can be tightened after the remaining Data commentary without changing the stable identity, Formula, snapshot, ChangeSet, or SQL invariants below.
</callout>
### Concept and authority
Data has two cooperating runtime aggregates:
1. **Declaration catalog** — stable name identity, mutable display names, Formula source bodies, per-entry revisions, immutable snapshots, and the Formula resolver adapter.
2. **Structured values** — typed tables, columns, rows, cells, variables, exact read snapshots, bounded set queries, aggregate ChangeSets, undo, redo, imports, and immutable artifact generations.
Data titles and column labels are presentation metadata. A Formula-visible name exists only as a declaration. That declaration may resolve stable Data references through the Data-owned resolver adapter.
<table fit-page-width="true" header-row="true">
<tr>
<td>Concern</td>
<td>Authority</td>
</tr>
<tr>
<td>Stable declaration IDs, display names, Formula source bodies, and declaration revisions</td>
<td>Data declaration catalog</td>
</tr>
<tr>
<td>Typed tables, columns, rows, cells, variables, exact values, revisions, and ChangeSets</td>
<td>Data structured-value aggregate</td>
</tr>
<tr>
<td>Immutable import attempts, generations, artifacts, descriptors, and source lineage</td>
<td>Data structured-value aggregate</td>
</tr>
<tr>
<td>Grammar, exact arithmetic, binding contract, evaluation, dependencies, and wire values</td>
<td>Platform Formula</td>
</tr>
<tr>
<td>The single sparse grid, stable row and column axes, cell formulas, ranges, and geometry</td>
<td>Spreadsheet</td>
</tr>
<tr>
<td>Charts, scenarios, assumptions, and analytical workspaces</td>
<td>Analysis</td>
</tr>
</table>
### Prerequisites
#### Core
- Platform Database supplies the SQLite connection, migrations, and configured store construction.
- Platform Formula supplies exact rational arithmetic, recursive `FormulaWireValue`, deterministic evaluation, and bounded set semantics.
- Platform Logger records mutations, query timings, import stages, and failures.
- The request registry, serial queue, concurrent queue, worker pool, and deferred-result mechanism are available for job wiring.
#### Integration gates
- Source-version readers supply exact CSV or XLSX bytes for imports.
- Spreadsheet later supplies exact snapshots of stable ranges inside its single sparse grid.
- Intelligence may propose bounded descriptors; deterministic validation remains the publication boundary.
### Repository placement
```plain text
apps/backend/src/
  3-capabilities/
    data/
      types.ts
      names.ts
      schemas.ts
      operations.ts
      footprints.ts
      snapshots.ts
      resolver-adapter.ts
      imports.ts
      store.ts
      sqlite-store.ts
      data.ts
      index.ts

  1-init/
    create/
      data.ts
      formula-resolver.ts

  4-job-wiring/
    data/
      registerDataEndpoints.ts
```
The SQLite schema is colocated with Data. Initialization binds the configured store, Formula, Logger, limits, exact-reader ports, and configured attribution.
## Types & Interfaces
### Formula value import
Data imports Formula’s persistent algebra. It does not define another scalar or table carrier.
```typescript
import {
  type FormulaWireValue,
  type FormulaResolverSnapshot,
  type FormulaEngine,
  toWire,
  fromWire
} from "#formula";

export type DataValue = FormulaWireValue;
```
The admitted persistent kinds are null, number, text, logic, list, record, and table. Numbers are exact reduced rationals encoded with decimal-string numerator and denominator. Lists, records, and tables use Formula’s recursive rectangular carrier. A cell may contain another list, record, or table. Encoding a function at any depth returns `NON_SERIALIZABLE_VALUE`.
### Recursive schema algebra
```typescript
export type DataType =
  | { readonly kind: "null" }
  | { readonly kind: "number" }
  | { readonly kind: "text" }
  | { readonly kind: "logic" }
  | {
      readonly kind: "list";
      readonly element: DataType;
      readonly nullableElements: boolean;
    }
  | {
      readonly kind: "record";
      readonly fields: readonly DataTypeField[];
      readonly additionalFields: false;
    }
  | {
      readonly kind: "table";
      readonly columns: readonly DataTypeField[];
    };

export interface DataTypeField {
  readonly key: string;
  readonly type: DataType;
  readonly nullable: boolean;
}
```
A nested table column may admit a table whose own columns admit further structured values. Validation reports the complete table, row, column, and nested-field path. A schema edit that could invalidate stored values requires an explicit deterministic conversion plan.
### Declaration catalog
```typescript
export type DataNameKind = "variable" | "function";

export interface DataNameEntry {
  readonly id: string;
  readonly namespaceId: string;
  readonly kind: DataNameKind;
  readonly displayName: string;
  readonly body: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt?: string;
}

export interface DataNameSnapshot {
  readonly id: string;
  readonly namespaceId: string;
  readonly entries: ReadonlyMap<string, DataNameEntry>;
  readonly snapshotRevision: number;
  readonly snapshotDigest: string;
  readonly createdAt: string;
}

export interface DataNameResolution {
  readonly found: boolean;
  readonly entry?: DataNameEntry;
  readonly ambiguous?: boolean;
  readonly candidates?: readonly DataNameEntry[];
}
```
A variable body is a Formula expression. A function body is a lambda expression. Value type is resolved when Formula evaluates the body. `namespaceId` is a logical declaration namespace such as shared, document, analysis, or spreadsheet; it is not request routing.
### Structured aggregate
```typescript
export interface DataState {
  readonly revision: number;
  readonly baseSeq: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DataBase {
  readonly format: "data";
  readonly tables: readonly DataTable[];
  readonly variables: readonly DataVariable[];
}

export interface DataTable {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly lifecycle: "active" | "archived";
  readonly columns: readonly DataColumn[];
  readonly rows: readonly DataRow[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DataColumn {
  readonly id: string;
  readonly tableId: string;
  readonly label: string;
  readonly rank: string;
  readonly type: DataType;
  readonly nullable: boolean;
  readonly defaultValue?: DataValue;
  readonly lifecycle: "active" | "archived";
}

export interface DataRow {
  readonly id: string;
  readonly tableId: string;
  readonly rank: string;
  readonly lifecycle: "active" | "archived";
  readonly cells: ReadonlyMap<string, DataValue>;
}

export interface DataVariable {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly type: DataType;
  readonly value: DataValue;
  readonly lifecycle: "active" | "archived";
  readonly createdAt: string;
  readonly updatedAt: string;
}
```
Stable IDs survive title and label edits, movement, schema changes, archive, restore, and Base compaction.
### Exact value snapshots
```typescript
export type DataValueRef =
  | { readonly kind: "variable"; readonly variableId: string }
  | { readonly kind: "table"; readonly tableId: string }
  | {
      readonly kind: "column";
      readonly tableId: string;
      readonly columnId: string;
    }
  | {
      readonly kind: "row";
      readonly tableId: string;
      readonly rowId: string;
    }
  | {
      readonly kind: "cell";
      readonly tableId: string;
      readonly rowId: string;
      readonly columnId: string;
    };

export interface ExactDataValue {
  readonly reference: DataValueRef;
  readonly value: DataValue;
  readonly valueDigest: string;
}

export interface DataValueSnapshot {
  readonly id: string;
  readonly revision: number;
  readonly values: readonly ExactDataValue[];
  readonly snapshotDigest: string;
  readonly createdAt: string;
}

export interface ReadDataValuesRequest {
  readonly references: readonly DataValueRef[];
  readonly atRevision?: number;
}
```
One read pins one revision before resolving any reference. Every returned value comes from that revision. Missing, archived, or schema-invalid targets fail with typed diagnostics; the reader never substitutes a newer value.
### Submission and ChangeSet
```typescript
export interface DataSubmission {
  readonly submissionId: string;
  readonly expectedRevision: number;
  readonly operations: readonly DataOperation[];
}

export interface DataChangeSet {
  readonly id: string;
  readonly submissionId: string;
  readonly submissionHash: string;
  readonly priorRevision: number;
  readonly revision: number;
  readonly seq: number;
  readonly authorId: string;
  readonly createdAt: string;
  readonly operations: readonly DataOperation[];
  readonly inverseOperations: readonly DataOperation[];
  readonly footprint: DataFootprint;
  readonly undoOf?: string;
  readonly redoOf?: string;
}

export interface DataFootprint {
  readonly tableStructure: readonly string[];
  readonly tableSchemas: readonly string[];
  readonly rows: readonly {
    tableId: string;
    rowId: string;
  }[];
  readonly cells: readonly {
    tableId: string;
    rowId: string;
    columnId: string;
  }[];
  readonly variables: readonly string[];
  readonly importedArtifacts: readonly string[];
}
```
Configured attribution is captured only when a submission becomes a ChangeSet. Endpoint payloads do not supply it.
### Reads and set queries
```typescript
export interface DataTableReadRequest {
  readonly tableId: string;
  readonly atRevision?: number;
  readonly columnIds?: readonly string[];
  readonly rowIds?: readonly string[];
  readonly afterRank?: string;
  readonly limit: number;
}

export interface DataTableQueryRequest {
  readonly tableId: string;
  readonly atRevision?: number;
  readonly selectColumnIds?: readonly string[];
  readonly condition?: {
    readonly source: string;
    readonly language: "formula";
  };
  readonly orderBy?: readonly {
    readonly columnId: string;
    readonly direction: "ascending" | "descending";
    readonly nulls: "first" | "last";
  }[];
  readonly after?: DataQueryCursor;
  readonly limit: number;
}

export interface DataQueryResult {
  readonly revision: number;
  readonly tableId: string;
  readonly selectedColumnIds: readonly string[];
  readonly value: DataValue & { readonly kind: "table" };
  readonly queryDigest: string;
  readonly next?: DataQueryCursor;
}
```
### Imports
```typescript
export interface RequestDataImport {
  readonly idempotencyKey: string;
  readonly sourceId: string;
  readonly sourceVersionId: string;
  readonly format: "csv" | "xlsx" | "spreadsheet-snapshot";
  readonly policy: DataImportPolicy;
}

export interface DataImport {
  readonly id: string;
  readonly sourceId: string;
  readonly sourceVersionId: string;
  readonly format: "csv" | "xlsx" | "spreadsheet-snapshot";
  readonly policyDigest: string;
  readonly state:
    | "queued"
    | "running"
    | "candidate-ready"
    | "ready"
    | "failed"
    | "interrupted";
  readonly currentGeneration?: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DataArtifact {
  readonly id: string;
  readonly importId: string;
  readonly generation: number;
  readonly kind:
    | "table"
    | "model-region"
    | "external-worksheet-map"
    | "external-workbook-map";
  readonly locator: SourceLocator;
  readonly schema: DataType;
  readonly shape: {
    readonly rows: number;
    readonly columns: number;
  };
  readonly value: DataValue;
  readonly valueDigest: string;
  readonly descriptor: DataDescriptor;
  readonly lineage: DataArtifactLineage;
}
```
An Icarus Spreadsheet snapshot always refers to one stable range inside one sparse grid. External XLSX parsing may preserve workbook and worksheet locators as source lineage; it does not introduce sheets into the Spreadsheet capability.
### Public capability
```typescript
export interface Data {
  snapshotNames(request: {
    namespaceId: string;
  }): Promise<DataNameSnapshot>;

  resolveName(request: {
    namespaceId: string;
    displayName: string;
  }): Promise<DataNameResolution>;

  getName(id: string): Promise<DataNameEntry | undefined>;
  listNames(request: {
    namespaceId: string;
    kind?: DataNameKind;
  }): Promise<DataNameEntry[]>;

  declareName(request: DeclareDataNameRequest): Promise<DataNameEntry>;
  renameName(request: RenameDataNameRequest): Promise<DataNameEntry>;
  updateNameBody(request: UpdateDataNameBodyRequest): Promise<DataNameEntry>;
  deleteName(request: DeleteDataNameRequest): Promise<void>;

  state(): Promise<DataState>;
  getTable(request: DataTableReadRequest): Promise<DataQueryResult>;
  listTables(request: ListDataTablesRequest): Promise<DataTableSummary[]>;
  listVariables(request: ListDataVariablesRequest): Promise<DataVariable[]>;
  readValues(request: ReadDataValuesRequest): Promise<DataValueSnapshot>;
  queryTable(request: DataTableQueryRequest): Promise<DataQueryResult>;

  submit(submission: DataSubmission): Promise<DataChangeSet>;
  undo(request: UndoDataRequest): Promise<DataChangeSet>;
  redo(request: RedoDataRequest): Promise<DataChangeSet>;
  history(request: DataHistoryRequest): Promise<DataChangeSetSummary[]>;

  requestImport(request: RequestDataImport): Promise<DataImport>;
  getImport(request: GetDataImport): Promise<DataImport>;
  refreshImport(request: RefreshDataImport): Promise<DataImport>;
  searchArtifacts(
    request: SearchDataArtifacts
  ): Promise<DataArtifactSummary[]>;
  readArtifact(request: ReadDataArtifact): Promise<DataArtifact>;
}
```
## Runtime Objects
### Construction
```typescript
export interface DataConfig {
  readonly maxDisplayNameBytes: number;
  readonly maxNamesPerNamespace: number;
  readonly maxTables: number;
  readonly maxColumnsPerTable: number;
  readonly maxRowsPerTable: number;
  readonly maxCellsPerSubmission: number;
  readonly maxVariables: number;
  readonly maxSnapshotCells: number;
  readonly maxQueryRows: number;
  readonly maxImportBytes: number;
  readonly maxArtifactsPerGeneration: number;
  readonly retainedChangeSets: number;
}

export function createData(
  database: Database,
  formula: FormulaEngine,
  config: DataConfig,
  logger: Logger,
  sourceReader?: ExactDataSourceReader,
  spreadsheetReader?: ExactSpreadsheetSnapshotReader,
  intelligence?: Intelligence
): Data;
```
### Declaration catalog runtime
A declaration has stable identity and per-entry compare-and-swap. Live display-name uniqueness is case-insensitive within one logical namespace. Snapshot construction reads every live entry in the namespace, sorts it by stable identity, captures each revision and body digest, and computes a canonical snapshot digest.
```plain text
Data.snapshotNames()
  -> immutable declaration snapshot
  -> DataFormulaResolverAdapter
  -> exact Data value snapshot
  -> FormulaResolverSnapshot
  -> FormulaEngine
```
### Resolver composition
```typescript
export interface DataFormulaResolverAdapter {
  snapshot(input: {
    readonly namespaceId: string;
    readonly declarationIds?: readonly string[];
    readonly dataRevision?: number;
  }): Promise<FormulaResolverSnapshot>;
}
```
The adapter freezes one declaration snapshot, parses the requested Formula bodies, extracts stable Data references, reads every reference at one structured revision, resolves declaration dependencies, detects cycles, evaluates bodies, and returns Formula-owned stable bindings and digests.
Data sees stable value references. Formula sees an immutable snapshot. The adapter is the only component that knows both representations.
### Structured aggregate runtime
The normalized Base represents state through `baseSeq`. ChangeSets after that sequence form the replay tail. Accepted ChangeSets remain in history after compaction.
Submission acceptance is one transaction:
1. validate bounds and canonicalize every operation;
2. hash the canonical submission;
3. return the original receipt for an identical retry;
4. reject reuse of an idempotency key with a different hash;
5. compare `expectedRevision` with the head revision;
6. rebase a stale submission only when retained history proves the complete footprint disjoint from every intervening ChangeSet;
7. apply the closed operation list to an immutable working state;
8. validate identities, ranks, recursive schemas, exact values, limits, and final invariants;
9. compute inverse operations and the semantic footprint;
10. append one ChangeSet and advance the revision atomically.
Schema edits conflict with stale edits to affected cells. Distinct stable rows and distinct cell triples may rebase when intervening structural edits preserve the targets.
Undo and redo append compensating ChangeSets at the current head. They never rewrite history. Base compaction folds a contiguous prefix into normalized rows, advances `baseSeq` under compare-and-swap, and preserves logical revision and replay result.
### Set query runtime
A query pins one Data revision, resolves stable Column IDs and their labels, materializes a bounded immutable Formula table, applies Formula projection and predicates, then returns the stable selected IDs, canonical table value, query digest, and revision-bound cursor.
Formula supplies:
- set-based filters and projections;
- positional indexing with one-based positive and backward negative indexes;
- one-based half-open slices with negative bounds;
- exact-one `!` and zero-or-one `?` cardinality promotion.
A cursor is invalid against another revision or query digest. Result limits apply before serialization.
### Import runtime
Each import generation is immutable. Refresh builds a complete candidate beside the published generation, reuses payloads with identical content digests, validates schemas and lineage, then advances `currentGeneration` atomically.
CSV parsing preserves exact decimals, nulls, empty text, quoting, embedded newlines, and leading-zero identifiers according to policy. XLSX parsing pins external workbook and worksheet locators. Spreadsheet-snapshot parsing pins one revision and stable range inside one sparse grid.
Intelligence may propose descriptors from bounded schema, profile, and sample cards. Deterministic validation checks every proposed field, relationship, statistic, range, and locator before publication. Model output cannot create or alter canonical values.
Promotion pins `artifactId`, generation, and value digest; creates normal editable table or variable identities; and records the exact lineage in the resulting ChangeSet.
## Change Operations
### Declaration operations
<table fit-page-width="true" header-row="true">
<tr>
<td>Operation</td>
<td>Effect</td>
<td>Revision boundary</td>
</tr>
<tr>
<td>declare-name</td>
<td>Creates a variable or function declaration</td>
<td>Insert at revision 1; SQL enforces live uniqueness</td>
</tr>
<tr>
<td>rename-name</td>
<td>Changes display name while preserving ID and body</td>
<td>Per-entry atomic compare-and-swap</td>
</tr>
<tr>
<td>set-name-body</td>
<td>Replaces Formula source while preserving ID and display name</td>
<td>Per-entry atomic compare-and-swap</td>
</tr>
<tr>
<td>delete-name</td>
<td>Soft-deletes a declaration</td>
<td>Per-entry atomic compare-and-swap</td>
</tr>
</table>
### Structured operation vocabulary
```typescript
export type DataOperation =
  | { readonly type: "create-table"; readonly table: NewDataTable }
  | {
      readonly type: "set-table-title";
      readonly tableId: string;
      readonly title: string;
    }
  | {
      readonly type: "set-table-description";
      readonly tableId: string;
      readonly description?: string;
    }
  | { readonly type: "archive-table"; readonly tableId: string }
  | { readonly type: "restore-table"; readonly tableId: string }
  | {
      readonly type: "add-column";
      readonly tableId: string;
      readonly column: NewDataColumn;
      readonly defaultValue?: DataValue;
    }
  | {
      readonly type: "update-column";
      readonly tableId: string;
      readonly columnId: string;
      readonly patch: DataColumnPatch;
      readonly conversion?: ValueConversionPlan;
    }
  | {
      readonly type: "move-column";
      readonly tableId: string;
      readonly columnId: string;
      readonly afterColumnId?: string;
    }
  | {
      readonly type: "archive-column";
      readonly tableId: string;
      readonly columnId: string;
    }
  | {
      readonly type: "restore-column";
      readonly tableId: string;
      readonly columnId: string;
    }
  | {
      readonly type: "insert-rows";
      readonly tableId: string;
      readonly afterRowId?: string;
      readonly rows: readonly NewDataRow[];
    }
  | {
      readonly type: "update-cells";
      readonly tableId: string;
      readonly cells: readonly {
        readonly rowId: string;
        readonly columnId: string;
        readonly value: DataValue;
      }[];
    }
  | {
      readonly type: "move-rows";
      readonly tableId: string;
      readonly rowIds: readonly string[];
      readonly afterRowId?: string;
    }
  | {
      readonly type: "archive-rows";
      readonly tableId: string;
      readonly rowIds: readonly string[];
    }
  | {
      readonly type: "restore-rows";
      readonly tableId: string;
      readonly rowIds: readonly string[];
    }
  | {
      readonly type: "create-variable";
      readonly variable: NewDataVariable;
    }
  | {
      readonly type: "set-variable-value";
      readonly variableId: string;
      readonly value: DataValue;
    }
  | {
      readonly type: "update-variable";
      readonly variableId: string;
      readonly patch: DataVariablePatch;
      readonly conversion?: ValueConversionPlan;
    }
  | { readonly type: "archive-variable"; readonly variableId: string }
  | { readonly type: "restore-variable"; readonly variableId: string }
  | {
      readonly type: "promote-imported-artifact";
      readonly artifactId: string;
      readonly generation: number;
      readonly contentDigest: string;
      readonly plan: DataPromotionPlan;
    };
```
Bulk operations are bounded and accepted atomically as one submission. Declaration operations remain explicit per-entry CAS operations inside the same capability; they are not silently folded into the structured aggregate’s revision clock.
## Endpoints
<table fit-page-width="true" header-row="true">
<tr>
<td>Method and path</td>
<td>Kind</td>
<td>Result</td>
</tr>
<tr>
<td>`POST /data/names`</td>
<td>Command</td>
<td>Declared name entry</td>
</tr>
<tr>
<td>`GET /data/names`</td>
<td>Query</td>
<td>Names in one logical namespace</td>
</tr>
<tr>
<td>`GET /data/names/entry`</td>
<td>Query</td>
<td>Name entry by ID</td>
</tr>
<tr>
<td>`PATCH /data/names/rename`</td>
<td>Command</td>
<td>Revision-checked rename</td>
</tr>
<tr>
<td>`PATCH /data/names/body`</td>
<td>Command</td>
<td>Revision-checked Formula body update</td>
</tr>
<tr>
<td>`DELETE /data/names`</td>
<td>Command</td>
<td>Revision-checked soft deletion</td>
</tr>
<tr>
<td>`GET /data/state`</td>
<td>Query</td>
<td>Current structured revision and Base sequence</td>
</tr>
<tr>
<td>`GET /data/tables`</td>
<td>Query</td>
<td>Bounded table summaries</td>
</tr>
<tr>
<td>`POST /data/table/read`</td>
<td>Query</td>
<td>Exact stable-ID row and column window</td>
</tr>
<tr>
<td>`POST /data/table/query`</td>
<td>Query</td>
<td>Bounded set filter, projection, ordering, and slice result</td>
</tr>
<tr>
<td>`GET /data/variables`</td>
<td>Query</td>
<td>Typed variables at an exact revision</td>
</tr>
<tr>
<td>`POST /data/values/read`</td>
<td>Query</td>
<td>Immutable exact value snapshot</td>
</tr>
<tr>
<td>`POST /data/submit`</td>
<td>Idempotent command</td>
<td>Accepted ChangeSet or typed conflict</td>
</tr>
<tr>
<td>`POST /data/undo`</td>
<td>Idempotent command</td>
<td>Compensating ChangeSet</td>
</tr>
<tr>
<td>`POST /data/redo`</td>
<td>Idempotent command</td>
<td>Compensating ChangeSet</td>
</tr>
<tr>
<td>`GET /data/history`</td>
<td>Query</td>
<td>Bounded ChangeSet summaries</td>
</tr>
<tr>
<td>`POST /data/imports`</td>
<td>Idempotent command</td>
<td>Import attempt identity and deferred receipt</td>
</tr>
<tr>
<td>`POST /data/imports/refresh`</td>
<td>Idempotent command</td>
<td>Candidate generation attempt</td>
</tr>
<tr>
<td>`GET /data/imports/status`</td>
<td>Query</td>
<td>Attempt, generation, state, and diagnostics</td>
</tr>
<tr>
<td>`POST /data/artifacts/search`</td>
<td>Query</td>
<td>Bounded descriptor and lineage matches</td>
</tr>
<tr>
<td>`POST /data/artifacts/read`</td>
<td>Query</td>
<td>Exact artifact and bounded value slice</td>
</tr>
<tr>
<td>`POST /data/artifacts/promote`</td>
<td>Idempotent command</td>
<td>Promotion ChangeSet</td>
</tr>
</table>
Exact path matching is used. IDs travel in query or body data.
## Jobs
<table fit-page-width="true" header-row="true">
<tr>
<td>Endpoint or intent</td>
<td>Job</td>
<td>Queue</td>
<td>Response</td>
<td>Calls or emits</td>
</tr>
<tr>
<td>Name reads and snapshots</td>
<td>`ReadDataNamesJob`</td>
<td>Concurrent</td>
<td>Inline</td>
<td>Reads declaration records or immutable snapshot</td>
</tr>
<tr>
<td>Name declare, rename, body update, delete</td>
<td>`MutateDataNameJob`</td>
<td>Serial</td>
<td>Inline</td>
<td>Emits a revision-checked declaration mutation</td>
</tr>
<tr>
<td>State, table, variable, exact-value, history, import-status, and artifact reads</td>
<td>Read job</td>
<td>Concurrent</td>
<td>Inline</td>
<td>Reads one exact revision or immutable generation</td>
</tr>
<tr>
<td>Bounded set query</td>
<td>`QueryDataTableJob`</td>
<td>Concurrent</td>
<td>Inline</td>
<td>Calls Formula against an immutable table snapshot</td>
</tr>
<tr>
<td>Submit, undo, redo, and promotion</td>
<td>Structured command job</td>
<td>Serial</td>
<td>Inline</td>
<td>Emits one DataChangeSet</td>
</tr>
<tr>
<td>Source parsing, profiling, descriptor proposal, and candidate generation</td>
<td>Import build job</td>
<td>Concurrent</td>
<td>Deferred</td>
<td>Persists immutable candidate and serial publication intent</td>
</tr>
<tr>
<td>Candidate publication</td>
<td>`PublishDataGenerationJob`</td>
<td>Serial internal stage</td>
<td>Internal</td>
<td>Atomically advances the published generation</td>
</tr>
<tr>
<td>Base compaction and projection rebuild</td>
<td>Maintenance job</td>
<td>Serial internal stage</td>
<td>Internal</td>
<td>Advances Base or replaces rebuildable projections</td>
</tr>
</table>
Concurrent work enters the worker pool immediately when capacity exists and otherwise remains in the concurrent queue. Serial work executes one job at a time. An import job persists its complete candidate and publication intent before it reports success and before serial publication is enqueued.
## SQL Tables
The names below are logical. The SQLite adapter maps them to configured physical names before migration and access.
### Declaration catalog
```sql
CREATE TABLE data_names (
  id           TEXT PRIMARY KEY CHECK (length(id) > 0),
  namespace_id TEXT NOT NULL CHECK (length(namespace_id) > 0),
  kind         TEXT NOT NULL CHECK (kind IN ('variable', 'function')),
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
  body         TEXT NOT NULL,
  revision     INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT
);

CREATE UNIQUE INDEX data_names_live_unique
  ON data_names(namespace_id, display_name COLLATE NOCASE)
  WHERE deleted_at IS NULL;

CREATE INDEX data_names_namespace_kind
  ON data_names(namespace_id, kind, display_name, id)
  WHERE deleted_at IS NULL;

CREATE INDEX data_names_updated
  ON data_names(updated_at DESC, id);
```
Rename, body update, and deletion are atomic compare-and-swap statements.
```sql
UPDATE data_names
SET display_name = ?,
    revision = revision + 1,
    updated_at = ?
WHERE id = ?
  AND revision = ?
  AND deleted_at IS NULL;

UPDATE data_names
SET body = ?,
    revision = revision + 1,
    updated_at = ?
WHERE id = ?
  AND revision = ?
  AND deleted_at IS NULL;

UPDATE data_names
SET deleted_at = ?,
    revision = revision + 1,
    updated_at = ?
WHERE id = ?
  AND revision = ?
  AND deleted_at IS NULL;
```
A zero-row update is resolved by re-reading the record and returning not-found, already-deleted, or stale-revision diagnostics. The live-name uniqueness index is the final conflict boundary.
### Structured state, tables, columns, rows, cells, and variables
```sql
CREATE TABLE data_state (
  singleton  INTEGER PRIMARY KEY CHECK (singleton = 1),
  revision   INTEGER NOT NULL CHECK (revision >= 0),
  base_seq   INTEGER NOT NULL CHECK (base_seq >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE data_tables (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  lifecycle   TEXT NOT NULL CHECK (lifecycle IN ('active', 'archived')),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX data_tables_lifecycle_title
  ON data_tables(lifecycle, title, id);

CREATE TABLE data_columns (
  id                 TEXT PRIMARY KEY,
  table_id           TEXT NOT NULL REFERENCES data_tables(id),
  label              TEXT NOT NULL,
  rank               TEXT NOT NULL,
  type_json          TEXT NOT NULL CHECK (json_valid(type_json)),
  nullable           INTEGER NOT NULL CHECK (nullable IN (0, 1)),
  default_value_json TEXT
    CHECK (default_value_json IS NULL OR json_valid(default_value_json)),
  lifecycle          TEXT NOT NULL CHECK (lifecycle IN ('active', 'archived')),
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  UNIQUE (table_id, id)
);

CREATE UNIQUE INDEX data_columns_live_label
  ON data_columns(table_id, label)
  WHERE lifecycle = 'active';

CREATE UNIQUE INDEX data_columns_live_rank
  ON data_columns(table_id, rank)
  WHERE lifecycle = 'active';

CREATE INDEX data_columns_table_lifecycle
  ON data_columns(table_id, lifecycle, rank);

CREATE TABLE data_rows (
  id         TEXT PRIMARY KEY,
  table_id   TEXT NOT NULL REFERENCES data_tables(id),
  rank       TEXT NOT NULL,
  lifecycle  TEXT NOT NULL CHECK (lifecycle IN ('active', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (table_id, id)
);

CREATE UNIQUE INDEX data_rows_live_rank
  ON data_rows(table_id, rank)
  WHERE lifecycle = 'active';

CREATE INDEX data_rows_table_lifecycle
  ON data_rows(table_id, lifecycle, rank);

CREATE TABLE data_cells (
  table_id     TEXT NOT NULL,
  row_id       TEXT NOT NULL,
  column_id    TEXT NOT NULL,
  value_json   TEXT NOT NULL CHECK (json_valid(value_json)),
  value_digest TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (table_id, row_id, column_id),
  FOREIGN KEY (table_id, row_id)
    REFERENCES data_rows(table_id, id),
  FOREIGN KEY (table_id, column_id)
    REFERENCES data_columns(table_id, id)
);

CREATE INDEX data_cells_column_row
  ON data_cells(table_id, column_id, row_id);

CREATE INDEX data_cells_value_digest
  ON data_cells(value_digest);

CREATE TABLE data_variables (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  type_json    TEXT NOT NULL CHECK (json_valid(type_json)),
  value_json   TEXT NOT NULL CHECK (json_valid(value_json)),
  value_digest TEXT NOT NULL,
  lifecycle    TEXT NOT NULL CHECK (lifecycle IN ('active', 'archived')),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX data_variables_lifecycle_title
  ON data_variables(lifecycle, title, id);

CREATE INDEX data_variables_value_digest
  ON data_variables(value_digest);
```
### ChangeSets and idempotency
```sql
CREATE TABLE data_change_sets (
  id                      TEXT PRIMARY KEY,
  submission_id           TEXT NOT NULL UNIQUE,
  submission_hash         TEXT NOT NULL,
  prior_revision          INTEGER NOT NULL,
  revision                INTEGER NOT NULL UNIQUE,
  seq                     INTEGER NOT NULL UNIQUE,
  author_id               TEXT NOT NULL,
  created_at              TEXT NOT NULL,
  operations_json         TEXT NOT NULL CHECK (json_valid(operations_json)),
  inverse_operations_json TEXT NOT NULL
    CHECK (json_valid(inverse_operations_json)),
  footprint_json          TEXT NOT NULL CHECK (json_valid(footprint_json)),
  undo_of                 TEXT REFERENCES data_change_sets(id),
  redo_of                 TEXT REFERENCES data_change_sets(id),
  compacted_at            TEXT,
  CHECK (revision = prior_revision + 1)
);

CREATE INDEX data_change_sets_recent
  ON data_change_sets(revision DESC);

CREATE INDEX data_change_sets_seq
  ON data_change_sets(seq);

CREATE INDEX data_change_sets_undo
  ON data_change_sets(undo_of)
  WHERE undo_of IS NOT NULL;

CREATE INDEX data_change_sets_redo
  ON data_change_sets(redo_of)
  WHERE redo_of IS NOT NULL;
```
Revision advancement, normalized-row changes, and ChangeSet insertion occur in one transaction. An identical `submission_id` returns the stored receipt; a different hash returns an idempotency conflict.
### Imports, immutable generations, artifacts, and lineage
```sql
CREATE TABLE data_imports (
  id                 TEXT PRIMARY KEY,
  idempotency_key    TEXT NOT NULL UNIQUE,
  source_id          TEXT NOT NULL,
  source_version_id  TEXT NOT NULL,
  format             TEXT NOT NULL CHECK (
    format IN ('csv', 'xlsx', 'spreadsheet-snapshot')
  ),
  policy_json        TEXT NOT NULL CHECK (json_valid(policy_json)),
  policy_digest      TEXT NOT NULL,
  state              TEXT NOT NULL CHECK (
    state IN (
      'queued',
      'running',
      'candidate-ready',
      'ready',
      'failed',
      'interrupted'
    )
  ),
  current_generation INTEGER,
  error_json         TEXT CHECK (error_json IS NULL OR json_valid(error_json)),
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

CREATE INDEX data_imports_source_version
  ON data_imports(source_id, source_version_id);

CREATE INDEX data_imports_state_updated
  ON data_imports(state, updated_at);

CREATE TABLE data_import_generations (
  import_id          TEXT NOT NULL REFERENCES data_imports(id),
  generation         INTEGER NOT NULL CHECK (generation >= 1),
  state              TEXT NOT NULL CHECK (
    state IN ('building', 'candidate-ready', 'published', 'failed')
  ),
  content_digest     TEXT,
  artifact_count     INTEGER NOT NULL DEFAULT 0 CHECK (artifact_count >= 0),
  created_at         TEXT NOT NULL,
  completed_at       TEXT,
  published_at       TEXT,
  PRIMARY KEY (import_id, generation)
);

CREATE INDEX data_import_generations_state
  ON data_import_generations(import_id, state, generation DESC);

CREATE TABLE data_artifacts (
  id               TEXT NOT NULL,
  import_id        TEXT NOT NULL,
  generation       INTEGER NOT NULL,
  kind             TEXT NOT NULL CHECK (
    kind IN (
      'table',
      'model-region',
      'external-worksheet-map',
      'external-workbook-map'
    )
  ),
  locator_json     TEXT NOT NULL CHECK (json_valid(locator_json)),
  schema_json      TEXT NOT NULL CHECK (json_valid(schema_json)),
  row_count        INTEGER NOT NULL CHECK (row_count >= 0),
  column_count     INTEGER NOT NULL CHECK (column_count >= 0),
  value_json       TEXT NOT NULL CHECK (json_valid(value_json)),
  value_digest     TEXT NOT NULL,
  descriptor_json  TEXT NOT NULL CHECK (json_valid(descriptor_json)),
  lineage_json     TEXT NOT NULL CHECK (json_valid(lineage_json)),
  created_at       TEXT NOT NULL,
  PRIMARY KEY (id, generation),
  FOREIGN KEY (import_id, generation)
    REFERENCES data_import_generations(import_id, generation)
);

CREATE INDEX data_artifacts_generation_kind
  ON data_artifacts(import_id, generation, kind, id);

CREATE INDEX data_artifacts_value_digest
  ON data_artifacts(value_digest);

CREATE TABLE data_import_stage_results (
  idempotency_key TEXT PRIMARY KEY,
  import_id       TEXT NOT NULL,
  generation      INTEGER NOT NULL,
  stage           TEXT NOT NULL,
  state           TEXT NOT NULL CHECK (
    state IN ('running', 'succeeded', 'failed')
  ),
  result_digest   TEXT,
  payload_json    TEXT CHECK (payload_json IS NULL OR json_valid(payload_json)),
  error_json      TEXT CHECK (error_json IS NULL OR json_valid(error_json)),
  started_at      TEXT NOT NULL,
  finished_at     TEXT,
  FOREIGN KEY (import_id, generation)
    REFERENCES data_import_generations(import_id, generation)
);

CREATE INDEX data_import_stage_results_generation
  ON data_import_stage_results(import_id, generation, stage);

CREATE TABLE data_artifact_promotions (
  artifact_id    TEXT NOT NULL,
  generation     INTEGER NOT NULL,
  value_digest   TEXT NOT NULL,
  change_set_id  TEXT NOT NULL REFERENCES data_change_sets(id),
  target_kind    TEXT NOT NULL CHECK (target_kind IN ('table', 'variable')),
  target_id      TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  PRIMARY KEY (artifact_id, generation, change_set_id),
  FOREIGN KEY (artifact_id, generation)
    REFERENCES data_artifacts(id, generation)
);

CREATE INDEX data_artifact_promotions_target
  ON data_artifact_promotions(target_kind, target_id);
```
### Rebuildable projections
Rebuildable tables may provide table profiles, column statistics, descriptor full-text search, descriptor embeddings, source-lineage reverse lookup, and query caches keyed by exact revision and query digest. Every projection records its source revision or immutable generation and projection-policy digest. Deleting and rebuilding projections cannot change Base rows, ChangeSets, stable identities, import generations, or artifact payloads.
## Invariants
1. Data is one capability boundary with separate declaration and structured-value revision domains.
2. Declaration IDs are stable; rename, body update, and deletion use atomic per-entry compare-and-swap.
3. One live display name exists per logical namespace.
4. Structured tables, columns, rows, and variables have stable identities.
5. The structured aggregate has one monotonic revision and contiguous ChangeSet sequence.
6. Identical submission retries return the original ChangeSet; mismatched retries fail.
7. Values import Formula’s exact recursive wire algebra.
8. Nested schemas validate the complete path before commit.
9. Exact reads pin one structured revision for all references.
10. Resolver composition freezes one declaration snapshot and one exact value snapshot.
11. Undo and redo append compensating ChangeSets.
12. Base compaction preserves logical revision and replay equivalence.
13. Imported generations are immutable and publish atomically.
14. Promotion records exact artifact generation and digest.
15. Model-produced descriptors become canonical only after deterministic validation.
16. Rebuildable projections can be recreated from canonical state.
17. Spreadsheet snapshot imports reference one stable range inside one sparse grid.
## Acceptance Criteria
- Declaration IDs survive renames and body updates.
- Concurrent declaration mutations cannot both pass one expected revision.
- Scalar and nested list, record, and table values round-trip byte-equivalently through Formula’s codec.
- Invalid multi-operation submissions reject atomically.
- Concurrent stale writes to the same cell conflict.
- Provably disjoint retained cell edits can rebase and commit.
- Schema changes conflict with stale writes to affected cells.
- Undo and redo replay deterministically.
- Exact value reads never mix structured revisions.
- Set queries follow Formula indexing, slicing, projection, filtering, and cardinality semantics.
- Query cursors fail against another revision or query digest.
- Resolver snapshots are identical for the same declaration and exact-value snapshots.
- An interrupted import refresh preserves the published generation.
- Promotion creates normal editable identities and exact lineage.
- Removing projections cannot change canonical state.
## Supporting Component References
- [Data declaration-catalog component reference](https://app.notion.com/p/3aeb6410e502810eb5e9f934994e730d)
- [Data structured-values component reference](https://app.notion.com/p/3aeb6410e502814ea854f1990496b5e4)
- [Formula runtime model](../platform/formula.md)
