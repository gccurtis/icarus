# Structured Data

*Verified against source at commit ef6d462, 2026-08-09.*

Structured Data is the project's single authority for every Formula-visible named declaration.
Its file header says it in two lines
([`types.ts:1-2`](../../../apps/backend/src/3-capabilities/structured-data/types.ts)) — *"Structured
Data types. // All named values in a project live here."* Five entry kinds live behind one flat
service and one SQLite table: `variable` and `function` hold Formula source text; `table`, `record`
and `list` hold a schema plus rows and share a single storage shape. Nothing else in the backend
owns a project name. Name Manager was removed, and the only path from a name to a Formula value
runs through `FormulaNameResolver`, an adapter that lives in `1-init` and reads exactly one
Structured Data instance.

---

## 1 · At a glance

| | |
| --- | --- |
| **Shape** | Flat — six files at the module root, no `domain/`, no `ports/` directory, no `wire/` |
| **Endpoints** | **16** — 5 POST, 5 GET, 4 PATCH, 2 DELETE. The second-largest HTTP surface in the backend, behind Investigation's 26 |
| **DB file** | `./data/structured-data.db`, opened at [`1-init/create/structured-data.ts:7,15`](../../../apps/backend/src/1-init/create/structured-data.ts) |
| **Tables** | **2** — `sd_<sha256(ownerId)[0:16]>_entries` and the shared `…_history`. `ownerId` is `config.projectId` at the one construction site |
| **Revision model** | Current row + history. `revision` starts at 1; every mutation is `revision + 1` and archives the pre-mutation row; every mutation is a CAS on `expectedRevision`; logical delete removes the row and leaves a terminal history record at `N+1` |
| **Test files (tests)** | [`structured-data-formula.test.ts`](../../../apps/backend/test/capabilities/structured-data-formula.test.ts) — 559 lines, **18 tests, 18 pass, 0 fail** |
| **Source files / lines** | **6 / 1,089** for `3-capabilities/structured-data/`. Add `4-job-wiring/structured-data/registerStructuredDataEndpoints.ts` (436) and `1-init/create/structured-data.ts` (17) for everything the capability owns: **8 / 1,542** |
| **Module `docs/`** | 6 files, 635 lines — the most reliable package in the tree (§10.11) |
| **Status** | Complete and wired. `contextEntries` is a write-never dead feature; the store sets `journal_mode = WAL` and no other pragma |

Per-file sizes, `wc -l`:

| File | Lines | What it holds |
| --- | ---: | --- |
| [`structured-data.ts`](../../../apps/backend/src/3-capabilities/structured-data/structured-data.ts) | 432 | Config, ten request types, the 14-method interface, `StructuredDataImpl`, the factory |
| [`validation.ts`](../../../apps/backend/src/3-capabilities/structured-data/validation.ts) | 272 | Every ingress rule, `DataValidationError`, the reserved-name set |
| [`sqlite-store.ts`](../../../apps/backend/src/3-capabilities/structured-data/sqlite-store.ts) | 246 | `SQLiteDataStore`, the DDL, the CAS transactions |
| [`types.ts`](../../../apps/backend/src/3-capabilities/structured-data/types.ts) | 106 | The domain types and three error classes |
| [`store.ts`](../../../apps/backend/src/3-capabilities/structured-data/store.ts) | 18 | The `DataStore` port — 10 synchronous methods |
| [`index.ts`](../../../apps/backend/src/3-capabilities/structured-data/index.ts) | 15 | The barrel |

---

## 2 · Domain model

### 2.1 The five entry kinds

```ts
export type DataKind = "variable" | "function" | "table" | "record" | "list";
```

`types.ts:6`. They split into two families that share one base and one row in one table.

`DataEntryBase` (`types.ts:16-25`), with its inline comments verbatim:

```ts
export interface DataEntryBase {
  readonly id: string;                      // stable UUID — never changes
  readonly kind: DataKind;
  readonly displayName: string;             // current user-visible name
  readonly description: string;            // human/AI summary
  readonly contextEntries: ContextEntry[]; // resources this entry is relevant to
  readonly revision: number;              // monotone counter; starts at 1
  readonly createdAt: string;             // ISO-8601
  readonly updatedAt: string;             // ISO-8601
}
```

`ContextEntry` is imported from `#context/types.js` (`types.ts:4`), which itself re-exports the
declaration in `0-platform/knowledge/types.ts:85`. The field is never written — see §10.1.

**Formula entries** (`types.ts:27-31`). Comment verbatim:
*"// variable and function — body is formula source text or lambda source text"*

```ts
export interface FormulaEntry extends DataEntryBase {
  readonly kind: "variable" | "function";
  readonly body: string;
}
```

**Collection entries** (`types.ts:50-58`). Comment verbatim, and it is the load-bearing statement
about the storage shape:

```
// table (many fields, many rows), record (many fields, one row),
// list (one unnamed field, many rows — schema has one synthetic field).
// All three share the same storage shape.
```

```ts
export interface CollectionEntry extends DataEntryBase {
  readonly kind: "table" | "record" | "list";
  readonly schema: FieldDef[];
  readonly rows: DataRow[];
  readonly rowCount: number; // denormalised
}
```

`DataEntry = FormulaEntry | CollectionEntry` (`types.ts:60`). One table stores both: a formula
entry writes `body` and leaves `schema_json`/`rows_json` NULL; a collection entry does the
opposite (`sqlite-store.ts:119-141`).

The three collection kinds are differentiated **only by cardinality rules**, enforced in
`validation.ts`, never in SQL:

| Kind | Schema rule | Row rule | Enforced at |
| --- | --- | --- | --- |
| `table` | ≤ `maxFieldsPerCollection` fields | ≤ `maxRowsPerCollection` rows | `validation.ts:106-108`, `:191-193` |
| `record` | any field count | **exactly 1 row** | `validation.ts:194-196` (declare/replace), `:233-235` (append), `:268-270` (delete rows) |
| `list` | **exactly 1 field** | any row count | `validation.ts:109-111` |

The resolver turns each into a Formula value: `list` → `makeList` over column 0 of every row,
`record` → `makeRecord(fields, rows[0])`, `table` → `makeTable(fields, rows)`
(`1-init/create/formula-name-resolver.ts:403-410`).

### 2.2 Field kinds — nine declared, seven admitted

```ts
// The authoritative set of value kinds — used in FieldDef and anywhere a
// resolved value type annotation is needed.
export type ValueKind =
  | "text" | "number" | "logic" | "date"
  | "table" | "record" | "list"
  | "function"
  | "unknown"; // escape hatch: not statically typeable
```

`types.ts:8-14`. `SUPPORTED_FIELD_KINDS` (`validation.ts:18-26`) admits only seven:
`text`, `number`, `logic`, `table`, `record`, `list`, `unknown`. **`date` and `function` are
representable in TypeScript and rejected at ingress** with `` `unsupported field kind: ${kind}` ``
(`validation.ts:126-131`). `structured-data-formula.test.ts` pins the `date` rejection. The
comment calling `ValueKind` "the authoritative set" is therefore at odds with the runtime set;
say so rather than reconciling it.

`FieldDef` is `{ name: string; kind: ValueKind }` (`types.ts:37-40`). Its comment (`types.ts:33-36`)
records that a field of kind `table`/`record`/`list` holds nested collections and that a `list`
entry's single field is synthetic.

### 2.3 Cell literals versus formula cells

`types.ts:42-48`, comment verbatim:

```
// A cell is either a literal value or a formula body that must resolve to the
// kind declared in the field's FieldDef at evaluation time.
```

```ts
export type CellLiteral = string | number | boolean | null;
export type CellFormula = { readonly formula: string };
export type CellValue  = CellLiteral | CellFormula;
export type DataRow    = Record<string, CellValue>;
```

`validateCell` (`validation.ts:148-179`) applies these rules in order:

| Input | Outcome | Line |
| --- | --- | ---: |
| `null` | accepted for **every** field kind, no type check | 154 |
| `string` / `boolean` | `validateLiteralKind` maps `boolean`→`logic`, `string`→`text`, demands an exact match unless the field kind is `unknown` | 155-158, 136-146 |
| `number` | must be `Number.isFinite`; an integer must be `Number.isSafeInteger` (*"integer must be within JavaScript's safe integer range"*), then the same kind check | 159-167 |
| plain object | must have **exactly one key, and it must be `formula`** — else *"formula cells must contain only a formula string"*; the value goes through `validateFormulaBody` under `maxBodyBytes` | 169-178 |
| anything else | *"unsupported cell value"* | 169-171 |

Two asymmetries a reader should hold on to:

- **Literals are checked at ingress; formula cells are not.** A `{formula: "..."}` cell is only
  checked for *syntax and size* on the way in. Its **kind** is checked after evaluation, in the
  resolver, by `valueMatchesField` (`formula-name-resolver.ts:98-102`, applied at `:388-397`).
- **Row keys must be declared schema fields, matched case-sensitively.** `validateCollectionRows`
  builds `new Map(schema.map(f => [f.name, f]))` (`validation.ts:198`) and rejects an undeclared
  key with *"is not declared in the schema"* (`:206-208`). Duplicate *field names* in a schema are
  rejected **case-insensitively** (`:119-123`). The two checks disagree on case, deliberately or
  not. A key omitted from a row is simply absent and later resolves to Formula `null`
  (`formula-name-resolver.ts:324`, `:358`).

### 2.4 Views, queries and errors

```ts
interface DataBindingView {
  readonly id: string;
  readonly entries: ReadonlyMap<string, DataEntry>; // keyed by normalized displayName
  readonly viewRevision: number;                    // max revision across included entries
  readonly createdAt: string;
}
interface DataQuery       { kind?: DataKind; text?: string; scope?: ContextEntry[] }
interface DataQueryResult { entries: DataEntry[]; totalCount: number }
```

`types.ts:62-79`. `viewRevision` is a **maximum over the included entries**, not a project-global
mutation sequence, and `id`/`viewRevision`/`createdAt` are computed on every call and read by
nothing (§10.8). `totalCount` is always `entries.length` — there is no pagination anywhere in this
capability (`structured-data.ts:183`).

Four error classes, three in `types.ts` and one in `validation.ts`:

| Class | Declared | Fields | Message |
| --- | --- | --- | --- |
| `DataEntryNotFoundError` | `types.ts:83-88` | `id` | `Data entry not found: ${id}` |
| `DataEntryConflictError` | `types.ts:90-95` | `displayName` | `Data entry '${displayName}' already exists` |
| `StaleDataRevisionError` | `types.ts:97-106` | `id`, `currentRevision`, `expectedRevision` | `Stale revision for ${id}: expected ${expectedRevision}, current ${currentRevision}` |
| `DataValidationError` | `validation.ts:28-36` | `field` | `` `${field}: ${message}` `` |

The capability also throws the two shared retention errors from
`0-utils/persistence/resourceHistory.ts` — `ResourceNotDeletedError` and
`ResourceHistoryNotFoundError` — from `purge` (`structured-data.ts:306-311`).

---

## 3 · The name authority: `normalizeKey`, collisions, and built-in shadowing

This is what makes Structured Data more than a CRUD service, and it is the part most easily got
wrong.

### 3.1 Two functions, different jobs

```ts
export function canonicalizeDisplayName(displayName: string): string {
  return displayName.trim();
}

/** Must stay aligned with Formula's ASCII, case-insensitive identifier lookup. */
export function normalizeDisplayNameKey(displayName: string): string {
  return canonicalizeDisplayName(displayName).toLowerCase();
}
```

`validation.ts:44-51`. **`canonicalizeDisplayName` trims only; only `normalizeDisplayNameKey`
lowercases.** The doc comment on line 48 is the contract: it declares the coupling to Formula's
own lookup normaliser, `0-platform/formula/resolver.ts:35-38`:

```ts
/** Normalize a display name for lookup (case-insensitive). */
export function normalizeKey(name: string): string {
  return name.toLowerCase();
}
```

The two differ only in the trim. Storage keeps the **trimmed original casing**; every lookup is
case-insensitive.

### 3.2 The collision rule, enforced twice

`validateDisplayName` (`validation.ts:53-75`) enforces, in order: must be a string; non-blank after
trim; matches `/^[A-Za-z_][A-Za-z0-9_]*$/` (*"must be an ASCII Formula identifier beginning with a
letter or underscore"*); not a reserved name; UTF-8 byte length ≤ `maxDisplayNameBytes`.

Uniqueness is then enforced in two places, and they can disagree under concurrency:

| Layer | Where | Behaviour |
| --- | --- | --- |
| Service precheck | `structured-data.ts:191-192` (`declare`), `:261-264` (`rename`) | `store.getByDisplayName(...)` → `DataEntryConflictError` → **HTTP 409** |
| Storage | `sqlite-store.ts:43-44` — `CREATE UNIQUE INDEX … ON sd_<p>_entries(display_name COLLATE NOCASE)` | Raw SQLite constraint error → falls through `sdError` to **HTTP 400 `bad_request`** |

The precheck can lose a race; SQLite still rejects the duplicate, but the client sees a 400 rather
than the 409 it would normally get. The module's own `docs/invariants.md:75-77` states this
correctly.

`rename` skips the conflict probe when the normalized key is unchanged
(`structured-data.ts:261`), so renaming `revenue` → `Revenue` — a pure case change of your own
name — is allowed. Lookups are `WHERE display_name = ? COLLATE NOCASE` (`sqlite-store.ts:101`) and
listings order by `display_name COLLATE NOCASE, id` (`:109`, `:114`).

### 3.3 Built-in shadowing is forbidden, by a second hard-coded list

`FORMULA_RESERVED_NAMES` (`validation.ts:11-16`) holds **30** entries and the check runs through
`normalizeDisplayNameKey`, so it is case-insensitive:

```
true, false, null, if, lambda, function, sum, product, min, max, avg, average, count,
abs, mod, power, pow, round, floor, ceil, ceiling, table, rows, columns, not, and, or,
text, number, concat
```

Formula's own `BUILTIN_NAMES` (`0-platform/formula/builtins.ts:22-27`) holds **27**:

```
IF, SUM, PRODUCT, MIN, MAX, AVG, AVERAGE, COUNT, ABS, MOD, POWER, POW, ROUND, FLOOR,
CEIL, CEILING, TABLE, ROWS, COLUMNS, LAMBDA, FUNCTION, NOT, AND, OR, TEXT, NUMBER, CONCAT
```

Checked element by element: the Structured Data list is an **exact superset** — all 27 built-ins
plus the three literal keywords `true`, `false`, `null`. **They agree today, and nothing keeps them
in sync**: the list is written out a second time rather than derived from `isBuiltinName()`. A
built-in added to Formula would become shadowable by a Structured Data declaration with no test
failing.

Two tests pin the rule:
`structured-data-formula.test.ts` — *"Structured Data rejects display names that collide under
Formula's case-insensitive lookup"* (declares `Revenue`, then rejects `revenue`), and *"Formula
built-ins are reserved and cannot be shadowed by Structured Data casing"* (declaring `sUm` is
rejected with `/reserved by Formula/i`, and `SUM([1, 2])` still evaluates to `3`).

Schema **field** names are validated with the same `validateDisplayName` but against a
**hard-coded 256-byte limit**, not `config.maxDisplayNameBytes` (`validation.ts:118`). A project
that raises `maxDisplayNameBytes` does not raise it for field names.

---

## 4 · Operations

`StructuredData` (`structured-data.ts:94-115`) is 14 methods. `pruneHistory` and `purgeExpired` are
the only two that are not `Promise`-returning — everything under them is synchronous SQLite.

| Group | Method | Notes |
| --- | --- | --- |
| Read | `bindingView()` | one `listAll()`, keyed by `normalizeDisplayNameKey` |
| | `get(id)` | |
| | `getByName(displayName)` | canonicalises (trims) before the `COLLATE NOCASE` lookup |
| | `list(kind?)` | |
| | `query(q)` | in-memory filter, no pagination |
| Write, all kinds | `declare(req)` | `revision: 1`, fresh `randomUUID()` |
| | `rename(req)` | CAS on `expectedRevision` |
| | `updateDescription(req)` | CAS |
| | `delete(req)` | CAS; removes the row, writes the terminal history record |
| | `purge(id)` | refuses a live entry; requires terminal deletion history |
| | `pruneHistory(cutoff)` | retention only; **sync** |
| | `purgeExpired(cutoff)` | retention only; **sync** |
| Write, formula only | `updateBody(req)` | refuses a collection kind (`:325-327`) |
| Write, collection only | `replaceSchema(req)` | re-validates **all retained rows** against the new schema (`:355-361`) |
| | `appendRows(req)` | validates **only the new payload** |
| | `deleteRows(req)` | indices must be unique, integral, in range |

Ten request types are declared (`structured-data.ts:36-92`) but **only `DeleteEntryRequest` is
re-exported from the barrel** (`index.ts:2`). The other nine are reachable only by deep-importing
`#structured-data/structured-data.js` — which is exactly what `1-init/create/structured-data.ts`
does for the factory and the store.

`query` (`structured-data.ts:157-184`) filters `listAll(q.kind)` twice: `q.text` is a
case-insensitive substring test over `displayName` **and** `description`; `q.scope` keeps an entry
when any stored `contextEntries` key `${kind}:${id}` overlaps. The second filter can never keep a
row — see §10.1.

**Empty payloads still consume a revision.** `appendRows([])` and `deleteRows([])` pass validation
and take the normal `revision + 1` CAS path.

---

## 5 · The name-resolution seam — `FormulaNameResolver`

The resolver is not part of the capability. It is
[`1-init/create/formula-name-resolver.ts`](../../../apps/backend/src/1-init/create/formula-name-resolver.ts),
438 lines, and it is an **adapter, not a factory**: it sits in the composition layer because it is
the seam between the `#formula` platform and the `#structured-data` capability, neither of which
may import the other. It is documented here because it is the only thing that turns a Structured
Data entry into a bindable Formula value, and because two of Structured Data's endpoints return its
error type on the wire.

```ts
export interface FormulaNameResolver {          // :15-18
  buildSnapshot(): Promise<FormulaResolverSnapshot>;
  getIssue(entryId: string): FormulaResolutionIssue | undefined;
}

export type FormulaResolutionIssueCode =        // :20-25
  | "parse_error" | "evaluation_error" | "invalid_collection"
  | "unresolved_dependency" | "cycle_error";

export interface FormulaResolutionIssue {       // :27-34
  readonly entryId: string;
  readonly displayName: string;
  readonly entryKind: DataEntry["kind"];
  readonly code: FormulaResolutionIssueCode;
  readonly diagnostics: readonly FormulaDiagnostic[];
  readonly dependencies?: readonly string[];
}
```

Constructed once, at `1-init/startBackend.ts:75`. Consumed by
`registerStructuredDataEndpoints.ts:8,28` and by `1-init/create/document.ts:2,58` — Document reads
Structured Data **only** through this port and never imports `#structured-data`.

### 5.1 The fixpoint

Comment verbatim (`:161-163`):

> ```
> // Resolve every entry iteratively. Literal collections settle immediately;
> // formula-backed cells wait for the same bindings as variables/functions,
> // which makes resolution independent of display-name ordering.
> ```

The loop (`:164-201`) walks every unresolved entry, at most `entries.length + 1` times. Each entry
returns one of three shapes: `waiting` (dependencies recorded, retried next pass, **does not count
as progress**), `failed` (an issue is recorded, `formula-resolver.entry-failed` is logged at warn,
and it **does** count as progress), or `resolved` (a binding is added). A pass that makes no
progress ends the loop. The `entries.length + 1` bound is deliberate — a linear chain of *n* entries
needs *n* passes, and *"resolver progress is bounded by entry count rather than an arbitrary pass
cap"* builds a 40-long chain and asserts the answer.

Leftovers are classified by the comment at `:203-205`, verbatim:

> ```
> // Leftovers are cyclic or refer to declarations that do not exist. They
> // remain absent from the Formula value algebra; null is reserved for an
> // authored null value.
> ```

An entry is `cycle_error` when it has dependencies and **every** one of them is still unresolved;
otherwise `unresolved_dependency` (`:206-228`). Both log `formula-resolver.unresolved-binding` at
warn.

That comment states the contract that the 422 wire shape depends on: **a failed declaration
produces no binding and a typed issue, never a `null` binding.** The regression test is *"failed
declarations remain typed resolver issues instead of becoming null bindings"* — a body of `1 / 0`
yields no binding and `getIssue(id).code === "evaluation_error"` with a `divide_by_zero`
diagnostic.

### 5.2 Caching and digests

`buildSnapshot` computes an entries signature —
`sha256` over the sorted `${id}:${revision}:${displayName}:${kind}` of every entry, truncated to 32
hex (`:124-132`) — and returns the cached snapshot on a match, logging
`formula-resolver.snapshot.cache-hit`. Because **every** content mutation increments `revision`, a
changed body, schema or row set invalidates the cache even though no body text is in the signature.
It is a single-slot, in-process cache, and there is one resolver in the backend, so it is
effectively a process-global memo.

`digestSnapshot` (`:43-61`) hashes the sorted list of
`{normalizedName, bindingId, ownerRevision, valueDigest}`. **`bindingId` participates**, so
re-creating an identically-valued entry under the same name changes the snapshot digest while the
value digest stays equal — asserted directly by *"resolver snapshot digest changes when the same
name and value get a new owner"*.

Stale binding behaviour is also pinned: *"rename makes an old bound Formula reference stale and
never retargets it to a new owner"* — after renaming the owner and declaring a new entry under the
old name, the previously-validated expression fails with a `stale_binding` diagnostic instead of
silently rebinding.

**One scaling cliff, stated plainly**: `resolveEntry` and `resolveCollection` each call
`makeSnapshotFromBindings` (`:264`, `:317`), which calls `randomUUID()` and a full
`digestSnapshot` sha256 over every binding — once per entry, per pass. For a chain of *n* entries
that is O(n²) hashes over a growing map. Nothing caps it.

---

## 6 · Endpoints

All 16 are registered by
[`registerStructuredDataEndpoints(registry, sd, formula, resolver, logger)`](../../../apps/backend/src/4-job-wiring/structured-data/registerStructuredDataEndpoints.ts)
(`:24-30`). `grep -c "registry.register"` → **16**, with no loops, so 16 call sites and 16
endpoints. Every job is `responseMode: "inline"`. Every job is `queueType: "concurrent"` **except
`POST /structured-data/purge`**, which is `serial`.

| # | Method + path | Job `name` | Queue | Line | Success | Does |
| ---: | --- | --- | --- | ---: | --- | --- |
| 1 | `POST /structured-data` | `structured-data.declare` | concurrent | 34 | **201** | declares a formula or collection entry; unknown `kind` → 400 |
| 2 | `GET /structured-data` | `structured-data.list` | concurrent | 69 | 200 | `?kind=` filter, cast without validation |
| 3 | `GET /structured-data/entry` | `structured-data.get` | concurrent | 82 | 200 / 404 | by `?id=` |
| 4 | `GET /structured-data/by-name` | `structured-data.getByName` | concurrent | 96 | 200 / 404 | by `?displayName=` |
| 5 | `PATCH /structured-data/rename` | `structured-data.rename` | concurrent | 110 | 200 | body `{id, newDisplayName, expectedRevision}` |
| 6 | `PATCH /structured-data/description` | `structured-data.updateDescription` | concurrent | 130 | 200 | |
| 7 | `DELETE /structured-data` | `structured-data.delete` | concurrent | 150 | **204** | reads `{id, expectedRevision}` from the **body** |
| 8 | `POST /structured-data/purge` | `structured-data.purge` | **serial** | 168 | **204** | requires a prior logical delete |
| 9 | `POST /structured-data/query` | `structured-data.query` | concurrent | 184 | 200 | `{kind, text, scope}` |
| 10 | `PATCH /structured-data/body` | `structured-data.updateBody` | concurrent | 200 | 200 | variable/function only |
| 11 | `PATCH /structured-data/schema` | `structured-data.replaceSchema` | concurrent | 220 | 200 | collection only |
| 12 | `POST /structured-data/rows` | `structured-data.appendRows` | concurrent | 240 | 200 | collection only |
| 13 | `DELETE /structured-data/rows` | `structured-data.deleteRows` | concurrent | 260 | 200 | reads `{id, indices, expectedRevision}` from the **body** |
| 14 | `GET /structured-data/value/entry` | `structured-data.valueByEntryId` | concurrent | 280 | 200 | evaluated value by `?id=` |
| 15 | `GET /structured-data/value/by-name` | `structured-data.valueByDisplayName` | concurrent | 332 | 200 | evaluated value by `?displayName=` |
| 16 | `POST /structured-data/evaluate` | `structured-data.evaluate` | concurrent | 384 | 200 | ad-hoc Formula source against the current snapshot |

Facts that are easy to get wrong:

- **Two DELETEs take a request body.** `DELETE /structured-data` (`:156`) and
  `DELETE /structured-data/rows` (`:267`) both read from `request.body`. Derived Outputs' `DELETE`
  by contrast reads the query string. The asymmetry is real.
- **Endpoints 2, 3, 4 and 9 have no `try/catch`.** An unexpected throw is not converted by
  `sdError`; it escapes into the transport's generic 500.
- **`?kind=` is unvalidated.** `registerStructuredDataEndpoints.ts:75` casts the raw query value
  straight to `DataKind`. An unknown kind reaches `listAll` and returns `[]` with a 200.
- Endpoints 14 and 15 are structurally identical — `:280-329` and `:332-381` differ only in
  `sd.get(id)` versus `sd.getByName(displayName)`.

### 6.1 Error mapping

`sdError` (`:14-22`) is the whole ladder:

| Thrown | Status | Body `error` |
| --- | ---: | --- |
| `DataEntryNotFoundError` | 404 | `not_found` |
| `DataEntryConflictError` | 409 | `conflict` |
| `StaleDataRevisionError` | 409 | `stale_revision` |
| `ResourceNotDeletedError` | 409 | `not_deleted` |
| `ResourceHistoryNotFoundError` | 404 | `not_found` |
| anything else, **including `DataValidationError`** | 400 | `bad_request` |

The last two shared rows are the cross-capability contract described in
[04-state-and-persistence.md](../04-state-and-persistence.md): all ten wiring files that handle the
retention errors map them identically.

### 6.2 The 422 contract and the typed `FormulaResolutionIssue`

`GET /structured-data/value/entry` walks a five-rung ladder (`:284-327`; `by-name` is identical at
`:336-379`):

1. `sd.get(id)` returns nothing → **404** `{error:"not_found"}`, plus
   `logger.warn("structured-data.value.entry.not-found")`.
2. `resolver.buildSnapshot()`, then `snapshot.bindings.get(normalizeKey(entry.displayName))`.
3. No binding **and** `resolver.getIssue(entry.id)` returns an issue → **422**
   `{ error: "resolution_error", issue }`. The `issue` is the whole `FormulaResolutionIssue`:
   entry id, display name, entry kind, one of the five codes, the Formula diagnostics, and the
   dependency list when there is one. **This is the typed contract** — a client can distinguish a
   parse error from a cycle from a missing dependency without parsing prose.
4. No binding **and no** recorded issue → **409** `{error:"unresolved"}`. See §10.2: this branch is
   defensive and unreachable.
5. Binding exists but `!isWireSerializable(binding.value)` — i.e. a function value → **422**
   `{error:"non_serializable_value", message:"Function values cannot be encoded on the wire"}`.
6. Otherwise **200**:
   ```
   { entry: { id, displayName, kind, revision },
     valueKind,
     value: toWire(binding.value),
     resolution: { snapshotDigest, bindingCount, ownerRevision, valueDigest } }
   ```

`POST /structured-data/evaluate` (`:384-435`) is the only endpoint that touches the `FormulaEngine`
directly. Parse failure → **400** `{error:"parse_error", diagnostics}`; evaluation failure → **400**
`{error:"evaluation_error", diagnostics}`; a function value → **422** `non_serializable_value`;
success → **200** with `valueKind, value, observedDependencies, dependencyDigest, evaluationDigest,
steps, snapshotDigest, bindingCount`. It is also the only endpoint with a catch-all, which logs
`structured-data.evaluate.unexpected` at **error** and returns 400.

### 6.3 Log events

| Level | Events |
| --- | --- |
| info (capability) | `data.declare`, `data.rename`, `data.update.desc`, `data.delete`, `data.purge`, `data.update.body`, `data.schema.replace`, `data.rows.append`, `data.rows.delete` |
| debug (capability) | `data.bindingView`, `data.query` |
| info (endpoints) | `structured-data.value.entry`, `structured-data.value.by-name`, `structured-data.evaluate` |
| warn (endpoints) | `structured-data.value.{entry,by-name}.{not-found,unresolved}`, `structured-data.evaluate.parse-error`, `structured-data.evaluate.eval-error` |
| error (endpoints) | `structured-data.evaluate.unexpected` |
| debug / warn (resolver) | `formula-resolver.snapshot.cache-hit`, `formula-resolver.snapshot-built` / `formula-resolver.entry-failed`, `formula-resolver.unresolved-binding` |

`get`, `getByName` and `list` log nothing. **No Formula source text is logged anywhere**; the
resolver's warn payloads carry the full `FormulaResolutionIssue`, which includes diagnostic
messages but not the body. Nothing in this capability passes a `detail` label, so every record
above is `shape` by default — see [06-platform-services.md](../06-platform-services.md).

---

## 7 · Persistence

`SQLiteDataStore` — [`sqlite-store.ts`](../../../apps/backend/src/3-capabilities/structured-data/sqlite-store.ts).
Table prefix is `sha256(ownerId).hex.slice(0, 16)` (`:22-23`).

**Pragmas: `journal_mode = WAL` and nothing else** (`sqlite-store.ts:86`). No `foreign_keys`, no
`busy_timeout`, no `synchronous`. Structured Data and Context are the only two stores in the
backend that set WAL alone; seven set all four. This is a real inconsistency, not a summarisable
"the same four everywhere".

### 7.1 `sd_<prefix>_entries` (`sqlite-store.ts:28-48`)

| Column | Type | Holds |
| --- | --- | --- |
| `id` | TEXT PRIMARY KEY | UUID, never reused |
| `kind` | TEXT NOT NULL | one of the five kinds — **no CHECK** |
| `display_name` | TEXT NOT NULL | trimmed original casing |
| `description` | TEXT NOT NULL DEFAULT '' | |
| `context_entries` | TEXT NOT NULL DEFAULT '[]' | JSON `ContextEntry[]`; always `[]` in practice |
| `body` | TEXT (nullable) | formula source; NULL for collections |
| `schema_json` | TEXT (nullable) | JSON `FieldDef[]`; NULL for formula entries |
| `rows_json` | TEXT (nullable) | JSON `DataRow[]`; NULL for formula entries |
| `row_count` | INTEGER NOT NULL DEFAULT 0 | denormalised; written `0` for formula entries |
| `revision` | INTEGER NOT NULL DEFAULT 1 | |
| `created_at` / `updated_at` | TEXT NOT NULL | ISO-8601 |

Indexes: `sd_<p>_entries_name_live_nocase` — **UNIQUE** on `display_name COLLATE NOCASE`
(`:43-44`); `sd_<p>_entries_kind` — non-unique on `kind` (`:46-47`).

**The table has no CHECK constraints at all.** `validation.ts` is the only schema authority for
kinds, cell shapes and JSON well-formedness. Compare Activity, which duplicates its origin and
revision rules as SQL CHECKs.

### 7.2 `sd_<prefix>_history`

Created by the shared helper `initializeResourceHistorySchema`
(`0-utils/persistence/resourceHistory.ts:42-64`, called at `sqlite-store.ts:49`). Columns:
`resource_kind` (always the literal `"structured-data"` here), `resource_id`,
`revision INTEGER NOT NULL CHECK (revision >= 1)`,
`record_type CHECK IN ('snapshot','deleted')`, `snapshot_json`, `recorded_at`; primary key
`(resource_kind, resource_id, revision)`; index `${table}_recorded` on
`(recorded_at, resource_kind, resource_id)`. SQL enforces the cross-check that a `snapshot` row has
a snapshot and a `deleted` row does not.

**There is no foreign key between the two tables.** Structured Data has no stable resource root, so
nothing links a history row to a live entry — contrast Derived Outputs, which has a real
`_resources` FK root and depends on it.

### 7.3 The revision model, spelled out

- `declare` writes `revision: 1` (`structured-data.ts:211`, `:238`) and inserts one row.
- Every mutation constructs `{...entry, …, revision: entry.revision + 1, updatedAt: now}` and calls
  `persistUpdate` (`structured-data.ts:124-129`), which turns a lost CAS into a typed error:
  no row at all → `DataEntryNotFoundError`; a row at a different revision →
  `StaleDataRevisionError`.
- `store.update(entry, expectedRevision)` (`sqlite-store.ts:143-180`) is **one `db.transaction`**:
  `SELECT … WHERE id = ? AND revision = ?` → if no row, return `false`; otherwise archive the row
  **as read** into history at `revision = expectedRevision`, then
  `UPDATE … WHERE id = ? AND revision = ?`, returning `changes === 1`.
  The history record's `recordedAt` is `entry.updatedAt` — the **new** timestamp, not the old one.
- `store.delete(id, expectedRevision, deletedAt)` (`:182-207`) is one transaction that archives a
  snapshot at `N`, inserts a **terminal deletion record at `N + 1`** with no snapshot, deletes the
  row, and returns `N + 1`.
- A deleted entry therefore has **no current row** and is invisible to `get`, `getByName`, `list`,
  `query`, `bindingView`, and every mutation. Its name is free again: a new declaration under the
  same name gets a **new UUID** and starts at revision 1 — and the resolver's snapshot digest
  changes even when the value is identical, because `bindingId` is in the digest.
- `purge(id)` (`:209-217`) returns `"current" | "purged" | "missing"`; the service maps `"current"`
  → `ResourceNotDeletedError` and `"missing"` → `ResourceHistoryNotFoundError`.
- `pruneHistory` supplies the `isCurrent` callback `(_kind, id) => Boolean(this.getEntry(id))`
  (`:233`), which is what lets a re-declared name reclaim an old tombstone; `purgeExpired`
  (`:237-245`) walks expired terminal deletions and purges each.

Retention is reached only through the shared scheduler:
`bindResourceRetentionPort("structured-data", structuredData)` at `1-init/startBackend.ts:143` —
the tenth of eleven ports, deliberately late, because Structured Data owns no child resources.

`history(id)` exists on the port (`store.ts:15`) and the adapter (`sqlite-store.ts:219-226`) and is
**called from nowhere in `src/`** — see §10.8.

---

## 8 · Invariants

| Invariant | Enforced at |
| --- | --- |
| Display name is a trimmed, non-blank ASCII Formula identifier | `validation.ts:53-66` |
| Display name is not a Formula reserved word (case-insensitive) | `validation.ts:67-69` |
| Display name ≤ `maxDisplayNameBytes` UTF-8 bytes | `validation.ts:70-73` |
| Schema field name ≤ **256** bytes, regardless of config | `validation.ts:118` |
| One current entry per case-insensitive name | `structured-data.ts:191-192` **+** UNIQUE index `sqlite-store.ts:43-44` |
| A rename to a differently-cased form of your own name is allowed | `structured-data.ts:261` |
| `maxEntries` cap | `structured-data.ts:194-197` — **read-then-insert, not atomic; can overshoot** |
| Formula body is a non-blank string ≤ `maxBodyBytes` | `validation.ts:84-96` |
| `list` schema has exactly one field | `validation.ts:109-111` |
| `record` holds exactly one row, at declare, append and delete | `validation.ts:194-196`, `:233-235`, `:268-270` |
| Duplicate schema field names rejected, case-insensitively | `validation.ts:119-123` |
| Row keys must be declared fields, matched case-sensitively | `validation.ts:198`, `:206-208` |
| Literal cell kind matches the field kind unless it is `unknown` | `validation.ts:136-146` |
| Numbers finite; integers safe | `validation.ts:160-165` |
| A formula cell object has exactly one key, `formula` | `validation.ts:172-175` |
| Delete indices are unique, integral and in range | `validation.ts:247-272` |
| `rowCount === rows.length` after every collection mutation | `structured-data.ts:237`, `:367`, `:396`, `:418` |
| Expected-revision check before every mutation | `structured-data.ts:254, 277, 292, 328, 347, 384, 410` |
| A lost CAS becomes a typed stale/not-found error | `structured-data.ts:124-129` |
| `updateBody` requires a variable or function | `structured-data.ts:325-327` |
| `replaceSchema`/`appendRows`/`deleteRows` require a collection | `structured-data.ts:344`, `:381`, `:407` |
| Schema replacement re-validates **all retained rows** | `structured-data.ts:355-361` |
| Append validates **only the new payload** | `validation.ts:236-244` |
| Purge refuses a live entry | `structured-data.ts:308` |
| Purge requires a terminal deletion record | `structured-data.ts:309` + `resourceHistory.ts` |
| A failed declaration yields an issue, never a `null` binding | `formula-name-resolver.ts:203-228` |

---

## 9 · Design decisions worth preserving

### On the alignment with Formula's lookup

`validation.ts:48` — one line, and it is the reason the whole name authority holds together:

> `/** Must stay aligned with Formula's ASCII, case-insensitive identifier lookup. */`

Structured Data trims and Formula does not, so the two normalisers are not identical functions;
they are identical *after* canonicalisation, which is what the comment is asserting.

### On not rescanning history on every append

`validation.ts:236-237`, verbatim:

> ```
> // Validate only the new payload. Existing values were admitted by an earlier
> // mutation and are not rescanned on every append.
> ```

`validateAppendRows` also does one subtle thing (`:238-244`): it delegates with
`entry.kind === "record" ? "table" : entry.kind`, so the record-one-row rule is not re-applied to
the *delta* — it has already been checked against the final count at `:233-235`. `replaceSchema` is
the deliberate exception: it re-runs every retained row through the new schema, and the test
*"Structured Data rejects schema replacement that invalidates retained rows"* asserts a
`number`→`text` retype is rejected with `/expected text, received number/i` and that the entry's
revision does not move.

### On one storage shape for three kinds

`types.ts:50-52` — quoted in full in §2.1. Table, record and list differ only in cardinality rules
applied at ingress and in which Formula constructor the resolver calls. Nothing in the schema
distinguishes them; `kind` is a plain TEXT column with no CHECK.

### On the scope of the store instance

Two comments disagree, and the sibling in `1-init` is the correct one.
`1-init/create/structured-data.ts:13-14`:

> ```
> // Structured Data is project-scoped at runtime. Prefixing by projectId keeps
> // tenant data separated inside the shared DB file.
> ```

`sqlite-store.ts:1-3` still says the opposite — *"Two store instances are used per backend: one for
user scope, one for project scope"* — and `store.ts:1-2` repeats it. **One instance exists**
(`startBackend.ts:74`). The store header is stale; the factory comment is current. The module's own
`docs/runtime.md:5` already flags this.

### On failures being issues rather than nulls

`formula-name-resolver.ts:203-205`, quoted in full in §5.1. *"null is reserved for an authored null
value"* is the sentence that makes the 422 contract meaningful: a client that receives a Formula
`null` knows a human wrote `null`, and a client that receives a 422 knows the declaration is
broken. Collapsing the two would have been cheaper and would have destroyed both signals.

---

## 10 · Known gaps and defects

Collected, with everything else in the backend, in [11-known-issues.md](../11-known-issues.md).

### 10.1 `contextEntries` is a write-never dead feature

`declare` hard-codes `contextEntries: []` at both construction sites
(`structured-data.ts:209`, `:234`) and **no service method, endpoint or job ever writes it**. The
column exists, the field round-trips through JSON, and `DataQuery.scope`
(`structured-data.ts:168-173`) filters on it — so the `scope` filter can only ever *eliminate* rows
and can never keep one. It is unreachable functionality, not a partially-wired one. The module's
own `docs/concepts.md:115` says so.

### 10.2 The `409 unresolved` branch is unreachable

`registerStructuredDataEndpoints.ts:300` and `:352` return
`{error:"unresolved"}` when there is no binding **and** no recorded issue. The resolver either
binds an entry or records an issue for it in the same pass (`formula-name-resolver.ts:182-189` for
failures, `:206-228` for leftovers), so the pair cannot both be absent. It survives as a defensive
branch and no test covers it.

### 10.3 Four endpoints have no error handling

`GET /structured-data`, `GET /structured-data/entry`, `GET /structured-data/by-name` and
`POST /structured-data/query` have no `try/catch`. Any throw from the store — a corrupt
`rows_json`, a locked database with no `busy_timeout` set — escapes `sdError` entirely and reaches
Fastify's generic 500 body, which carries no `error` code.

### 10.4 `maxEntries` is not an atomic quota

`structured-data.ts:194-197` reads `store.listAll()` and compares its length before inserting.
Two concurrent declares can both observe `length === maxEntries - 1`. The cap can be exceeded by
the number of in-flight declares. The module's `docs/invariants.md:74` records this.

### 10.5 The reserved-name list is duplicated, not derived

`validation.ts:11-16` versus `0-platform/formula/builtins.ts:22-27` — verified equal today (a
27-element superset plus three keywords), with nothing enforcing it. `isBuiltinName()` is exported
and is not used here.

### 10.6 The `date` and `function` field kinds are declared and rejected

`ValueKind` calls itself *"the authoritative set of value kinds"* (`types.ts:8-9`) and includes
`date` and `function`; `SUPPORTED_FIELD_KINDS` admits neither. **There is no date support anywhere
in the backend.**

### 10.7 The store sets WAL and no other pragma

`sqlite-store.ts:86`. In particular there is no `busy_timeout`, so a concurrent writer on
`structured-data.db` gets an immediate `SQLITE_BUSY` rather than a bounded wait — and, per §10.3,
four endpoints would surface that as an uncoded 500.

### 10.8 Dead and test-only surface

| Symbol | Status |
| --- | --- |
| `validateDataKind` (`validation.ts:77-82`) | Exported from `validation.ts`, **not** on the barrel, **zero call sites** in `src/` or `test/` |
| `DataStore.history(id)` (`store.ts:15`, `sqlite-store.ts:219-226`) | On the port and implemented; called only from the test file. There is no history endpoint and no undo |
| `DataBindingView.id`, `.viewRevision`, `.createdAt` | Computed on every `bindingView()` call; its only consumer reads `.entries` alone (`formula-name-resolver.ts:122-123`) |
| Nine of ten request types | Declared in `structured-data.ts:36-92`, only `DeleteEntryRequest` is on the barrel |
| `normalizeDisplayNameKey` | On the barrel; no importer outside the capability |

### 10.9 No pagination, anywhere

`DataQueryResult.totalCount` is `entries.length` (`structured-data.ts:183`), not a pre-pagination
total. `list` and `query` return every matching row. With `maxEntries` defaulting to 10,000 and
`maxRowsPerCollection` to 100,000, a single `GET /structured-data` can serialise the entire
project's data.

### 10.10 The resolver's O(n²) digesting

`formula-name-resolver.ts:264` and `:317` — described in §5.2. Not a bug; a real cliff with no cap
and no test.

### 10.11 Where the module's own `docs/` package is imprecise

`3-capabilities/structured-data/docs/` is 6 files, 635 lines, and is the **most reliable module
package in the tree**: it self-reports the `date`/`function` gap, the non-atomic `maxEntries` check,
the racy conflict precheck, the unpopulated `contextEntries`, the `viewRevision` caveat, the
hard-coded 256-byte field-name limit, the unvalidated `kind` cast, and even the stale two-instance
comment in its own store. A later pass owns those files; three imprecisions are recorded here so a
reader of both is not misled.

| File | Claim | Reality |
| --- | --- | --- |
| `docs/runtime.md:53` | `canonicalizeDisplayName` / `normalizeDisplayNameKey` — "Trim; then ASCII-case normalize to lowercase" | One row merges two functions with different behaviour: `canonicalizeDisplayName` **trims only** |
| `docs/invariants.md:87` | "bounded by entry count rather than an arbitrary 32-pass ceiling" | True, but `32` appears nowhere in the current source; it compares against code that no longer exists |
| `docs/README.md:54`, `:55`, `:57` | Link out to design drafts under `scratch/` | Those are the owner's live drafts, deliberately ahead of the code. They are not evidence for anything on this page |

---

## 11 · Where to look for what

| Concern | File |
| --- | --- |
| The five kinds, the cell union, the errors | [`types.ts`](../../../apps/backend/src/3-capabilities/structured-data/types.ts) |
| Every ingress rule and the reserved-name set | [`validation.ts`](../../../apps/backend/src/3-capabilities/structured-data/validation.ts) |
| The service, the CAS, the request types | [`structured-data.ts`](../../../apps/backend/src/3-capabilities/structured-data/structured-data.ts) |
| DDL, indexes, the transactional CAS | [`sqlite-store.ts`](../../../apps/backend/src/3-capabilities/structured-data/sqlite-store.ts) |
| The port | [`store.ts`](../../../apps/backend/src/3-capabilities/structured-data/store.ts) |
| HTTP, the 422 contract, `evaluate` | [`registerStructuredDataEndpoints.ts`](../../../apps/backend/src/4-job-wiring/structured-data/registerStructuredDataEndpoints.ts) |
| Name → Formula value, the fixpoint, the digests | [`1-init/create/formula-name-resolver.ts`](../../../apps/backend/src/1-init/create/formula-name-resolver.ts) |
| Construction | [`1-init/create/structured-data.ts`](../../../apps/backend/src/1-init/create/structured-data.ts) |

Related pages: [06-platform-services.md](../06-platform-services.md) for the Formula engine this
capability is the name authority for, [04-state-and-persistence.md](../04-state-and-persistence.md)
for the shared history table and the retention sweep,
[document.md](document.md) for the only other consumer of `FormulaNameResolver`, and
[09-configuration.md](../09-configuration.md) for the `structuredData` limits.

The superseded design page is at
[phase-1/capabilities-old/data.md](../../phase-1/capabilities-old/data.md). It describes a "Data"
capability with two aggregates, typed columns, exact read snapshots, aggregate ChangeSets, undo,
redo, imports and immutable artifact generations. **None of that exists.** Do not cite it.
