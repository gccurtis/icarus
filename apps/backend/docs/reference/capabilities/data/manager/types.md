# Structured Data types and persistence

## Entry type algebra

`types.ts` defines:

```ts
type DataKind = "variable" | "function" | "table" | "record" | "list";

type ValueKind =
  | "text" | "number" | "logic" | "date"
  | "table" | "record" | "list" | "function" | "unknown";
```

`ValueKind` is a broad type vocabulary. `validation.ts` currently admits only `text`, `number`, `logic`, `table`, `record`, `list`, and `unknown` as collection field definitions. `date` and `function` are therefore representable in TypeScript but rejected at mutation ingress.

### Common and formula entries

```ts
interface DataEntryBase {
  id: string;
  kind: DataKind;
  displayName: string;
  description: string;
  contextEntries: ContextEntry[];
  revision: number;
  createdAt: string;
  updatedAt: string;
}

interface FormulaEntry extends DataEntryBase {
  kind: "variable" | "function";
  body: string;
}
```

### Collection entries

```ts
interface FieldDef { name: string; kind: ValueKind }
type CellLiteral = string | number | boolean | null;
type CellFormula = { readonly formula: string };
type CellValue = CellLiteral | CellFormula;
type DataRow = Record<string, CellValue>;

interface CollectionEntry extends DataEntryBase {
  kind: "table" | "record" | "list";
  schema: FieldDef[];
  rows: DataRow[];
  rowCount: number;
}
```

`DataEntry` is the formula/collection union. `rowCount` is denormalized and rewritten from `rows.length` by service mutations.

## Views and queries

| Type | Fields / semantics |
|---|---|
| `DataBindingView` | Random `id`, normalized-name `ReadonlyMap`, maximum included entry revision as `viewRevision`, ISO `createdAt` |
| `DataQuery` | Optional `kind`, text substring, and `ContextEntry[]` overlap scope |
| `DataQueryResult` | Filtered `entries` and equal `totalCount` |

`viewRevision` is not a project-global sequence. It is the maximum per-entry
revision in that particular current set and can remain unchanged across
mutations.

## Request types

`structured-data.ts` defines these service request families:

| Request | Required fields |
|---|---|
| `DeclareFormulaEntryRequest` | formula kind, display name, body; optional description |
| `DeclareCollectionEntryRequest` | collection kind, display name, schema; optional rows/description |
| `RenameEntryRequest` | ID, new display name, expected revision |
| `UpdateBodyRequest` | ID, body, expected revision |
| `UpdateDescriptionRequest` | ID, description, expected revision |
| `DeleteEntryRequest` | ID, expected revision |
| `ReplaceSchemaRequest` | ID, complete schema, expected revision |
| `AppendRowsRequest` | ID, new rows, expected revision |
| `DeleteRowsRequest` | ID, zero-based indices, expected revision |

Only `DeleteEntryRequest` is currently re-exported from the barrel alongside `StructuredData` and its config; direct imports can access the other request interfaces from the implementation module.

## Error family

| Error | Payload | Meaning | HTTP mapping |
|---|---|---|---:|
| `DataEntryNotFoundError` | `id` | No current entry by ID | 404 |
| `DataEntryConflictError` | `displayName` | Current case-insensitive name conflict | 409 |
| `StaleDataRevisionError` | ID/current/expected revisions | Revision check or SQLite CAS lost | 409 |
| `DataValidationError` | `field`, prefixed message | Ingress shape/kind/limit failure | default 400 |
| ordinary `Error` | message | Wrong operation for kind, max entries, store/resolver failures | default 400 at CRUD endpoint layer |

Formula value endpoints also return structured `resolution_error`, `unresolved`, parse/evaluation diagnostics, and `non_serializable_value` responses rather than turning them into these domain errors.

## Store contract

`DataStore` is synchronous and already bound to one owner prefix:

```ts
interface DataStore {
  getEntry(id: string): DataEntry | undefined;
  getByDisplayName(name: string): DataEntry | undefined;
  listAll(kind?: DataKind): DataEntry[];
  insert(entry: DataEntry): void;
  update(entry: DataEntry, expectedRevision: number): boolean;
  delete(id: string, expectedRevision: number, recordedAt: string): number | undefined;
  purge(id: string): "purged" | "current" | "missing";
  history(id: string): ResourceHistoryRecord<DataEntry>[];
  pruneHistory(cutoff: string): number;
  purgeExpired(cutoff: string): number;
}
```

Update returns CAS success. Delete returns terminal revision `N + 1` when its
current-row CAS wins. All normal reads use the current table only.

## SQLite representation

`SQLiteDataStore` uses `./data/structured-data.db`, WAL
mode, current table `sd_${sha256(projectId).slice(0,16)}_entries`, and matching
`_history` table.

| Columns | Representation |
|---|---|
| common metadata | scalar `TEXT`/`INTEGER` columns |
| `contextEntries` | JSON string in `context_entries` |
| formula body | `body`; schema/rows null |
| collection schema/rows | JSON in `schema_json` / `rows_json`; body null |
| history | complete prior `DataEntry` JSON snapshots and terminal deletion records keyed by kind/ID/revision |

A `display_name COLLATE NOCASE` unique index enforces one current
case-insensitive name. An index supports kind reads. The current table itself
has few `CHECK` constraints; application validation is the primary schema
authority.

## Formula and wire representation

Structured Data persists source/literal shapes, not Formula's runtime values. The Formula resolver converts literals to Formula values, evaluates formula bodies/cells, and creates `FormulaResolverSnapshot` bindings containing stable ID, owner revision, value digest, and snapshot digest.

Evaluated endpoints call Formula `toWire`. Recursive values such as exact rational numbers/tables are encoded by Formula. Function values are explicitly non-serializable and produce HTTP 422 instead of a JSON function surrogate.
