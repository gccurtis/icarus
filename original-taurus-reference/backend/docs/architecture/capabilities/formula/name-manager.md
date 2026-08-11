# Name manager

`names` is Formula's per-project namespace: stored scalars, tables, and
functions that an expression is evaluated against. It is the state layer over
the pure evaluator — it imports `formula` for the `Value` model, parsing, and
the `Resolver` port, but `formula` never imports it. The dependency runs one
direction only, `names → formula`, exactly as
[record 0021](../../../records/0021-formula-functions.md) anticipated when it
added the `Resolver` port ahead of any concrete consumer.

The implementation lives in
[`core/capability/formula/names`](../../../../core/capability/formula/names/):

| Source | Responsibility |
|---|---|
| [`names.go`](../../../../core/capability/formula/names/names.go) | `EntryType`/`ColumnType`, `Column`, `Entry`, sentinel errors, the `NameStore` port, and `Manager`/`New` |
| [`memory.go`](../../../../core/capability/formula/names/memory.go) | `MemoryStore`, an in-memory `NameStore` |
| [`manager.go`](../../../../core/capability/formula/names/manager.go) | `SetScalar`/`SetTable`/`SetFunction`/`Get`/`List`/`Delete`, with name, schema, and cell-type validation |
| [`resolver.go`](../../../../core/capability/formula/names/resolver.go) | `reconstruct`, `namespaceResolver` (a `formula.Resolver`), and `Manager.Evaluate` |

Two small, additive helpers on the `formula` side exist for this package to
call: `IsIdentifier`
([`syntax.go:373-379`](../../../../core/capability/formula/syntax.go#L373-L379))
and `IsReservedName`
([`functions.go:103-117`](../../../../core/capability/formula/functions.go#L103-L117)).
Neither changes any existing `formula/v1` behavior.

## The entry type model

Every stored name has exactly one `EntryType` — `null`, `number`, `text`,
`logic`, `table`, or `function`
([`names.go:19-29`](../../../../core/capability/formula/names/names.go#L19-L29))
— and an `Entry` populates only the field its type needs
([`names.go:48-57`](../../../../core/capability/formula/names/names.go#L48-L57)):

| Type | Populated field | What it holds |
|---|---|---|
| `null`/`number`/`text`/`logic` (scalar) | `Value` | the `formula.Value` itself |
| `table` | `Schema`, `Rows` | declared columns and cell data |
| `function` | `Source` | the exact `FUNCTION`/`LAMBDA` source text |

There is no separate `list` or `record` `EntryType`. Formula itself has no
dedicated table literal — a list is a one-field table and a record is a
one-row table, both views over the same rectangular carrier (see
[Data model](data-model.md#the-shared-table-carrier)) — and the name manager
follows that model exactly: a stored "list" is a one-`Column` schema, a stored
"record" is a one-row `Rows`, and both are simply `TypeTable` entries.

A table's declared column type (`ColumnNumber`, `ColumnText`, `ColumnLogic`,
`ColumnTable`) is a scalar kind or nested-table kind, not a full `EntryType` —
it constrains what a *cell* may hold, not what a top-level entry is
([`names.go:31-40`](../../../../core/capability/formula/names/names.go#L31-L40)).

## Name rules: entries vs. columns

The manager enforces two related but distinct rules, and the distinction is
deliberate:

- **Entry names** (scalars, tables, functions) must be a legal Formula
  identifier *and* must not collide with a builtin or keyword. `validateName`
  checks both, in that order, on every `SetScalar`/`SetTable`/`SetFunction`
  call
  ([`manager.go:68-76`](../../../../core/capability/formula/names/manager.go#L68-L76)):
  `IsIdentifier` rejects a non-identifier name (`ErrInvalidName`), and
  `IsReservedName` rejects `SUM`, `IF`, `FUNCTION`, `true`, `null`, and every
  other builtin or keyword, case-insensitively (`ErrReservedName`). This keeps
  a bare identifier's meaning fixed: `SUM` always means the aggregate
  function, `null` always means the literal, never a stored entry shadowing
  them.
- **Table column names** must be a legal identifier but *may* be a reserved
  word. `validateSchema` checks only `IsIdentifier`, never `IsReservedName`,
  for each column
  ([`manager.go:78-93`](../../../../core/capability/formula/names/manager.go#L78-L93)).
  A column named `Sum` or `Table` is allowed. This is safe because a column is
  never resolved as a top-level identifier — it is only ever reached through
  dot-field access (`people.Sum`), and Formula's own rule is that a name a dot
  can spell is a legal field name (see
  [Data model](data-model.md#literals-and-construction)). A reserved word
  reaching an entry name would be ambiguous at the call site; the same word as
  a column name never is.

## Setting entries: validation and type enforcement

`SetScalar` accepts a `formula.Value` and stores it under the `EntryType`
matching its `Kind()`; a structured value (list, record, table, function) is
rejected with `ErrNotScalar`
([`manager.go:6-24`](../../../../core/capability/formula/names/manager.go#L6-L24)).

`SetFunction` parses `source` and requires it to be a bare `FUNCTION`/`LAMBDA`
definition (`expression.Root.Type == formula.NodeFunction`), rejecting
anything else — including a perfectly valid non-function expression like
`"1 + 2"` — with `ErrNotAFunction`
([`manager.go:42-57`](../../../../core/capability/formula/names/manager.go#L42-L57)).
Only the source text is stored; free identifiers inside the body are resolved
later, against the namespace, when the function is applied (see
[Evaluate](#evaluate-snapshot-then-resolve) below and
[User-defined functions](functions.md#lexical-closures-with-late-binding)).

`SetTable` stores a schema and rows wholesale, after three checks
([`manager.go:26-40`](../../../../core/capability/formula/names/manager.go#L26-L40)):

1. `validateSchema` — every column name is an identifier, every column type is
   one of the four `ColumnType`s, and no column name repeats
   (`ErrInvalidColumnType`, `ErrDuplicateColumn`).
2. `validateRows` — every row's width matches the schema (`ErrRaggedRow`), and
   every cell is checked against its column's declared type.
3. Within that per-cell check, `cellMatches` allows `null` unconditionally,
   requires an exact `Kind()` match for a scalar column, and accepts any of
   `KindTable`/`KindList`/`KindRecord` for a `ColumnTable` column
   ([`manager.go:121-141`](../../../../core/capability/formula/names/manager.go#L121-L141)).
   Ahead of the type check, `containsFunction` walks the cell (recursing into
   list items, record fields, and table rows) and rejects it outright with
   `ErrFunctionInCell` if a function value appears anywhere inside — a
   function may never be stored as a cell, regardless of the column's
   declared type
   ([`manager.go:143-174`](../../../../core/capability/formula/names/manager.go#L143-L174)).

`SetTable` stores its own deep copies of the schema and rows
(`cloneColumns`/`cloneRows`,
[`manager.go:176-186`](../../../../core/capability/formula/names/manager.go#L176-L186)),
so a caller cannot corrupt a stored table by mutating the slices passed in.

## Reconstruction into a `Value`

The seam between the namespace and the pure evaluator is `namespaceResolver`,
which implements `formula.Resolver` over an immutable snapshot of entries
([`resolver.go:5-25`](../../../../core/capability/formula/names/resolver.go#L5-L25)).
Its `Resolve` looks an identifier up in the snapshot and, if present, calls
`reconstruct` to turn the stored `Entry` into a `formula.Value` on demand
([`resolver.go:27-47`](../../../../core/capability/formula/names/resolver.go#L27-L47)):

- a scalar entry's stored `Value` is returned as-is;
- a table entry becomes `formula.TableValue(fields, entry.Rows)` — always a
  `KindTable` value, never `KindList`/`KindRecord`, regardless of whether the
  stored shape was conceptually a list or a record. A consequence worth
  stating plainly: a table entry's *column* still reads back as a list (dot
  field access on a table column always yields a list — see
  [Data model](data-model.md#object-model-operations)), so `SUM(people.score)`
  works exactly as it would against any other table value;
- a function entry is produced by evaluating its stored source
  (`service.Evaluate(entry.Source, nil)`). Evaluating a bare `FUNCTION`/
  `LAMBDA` definition never resolves a free identifier — defining a function
  only builds the closure, it does not run the body — so this reconstruction
  is safe with no bindings at all. The function's free names (like `factor`
  in `FUNCTION(n, n * factor)`) are left unresolved in the returned value and
  bind only later, when the function is *applied*, against whichever
  resolver the applying evaluator is using — normally this same namespace
  (see [Evaluate](#evaluate-snapshot-then-resolve)). This is the same
  late-binding rule [User-defined functions](functions.md#lexical-closures-with-late-binding)
  describes for ordinary `Bindings`-based evaluation, unchanged here.

## `Evaluate`: snapshot, then resolve

`Manager.Evaluate` lists every entry in the project once, indexes it by name,
and evaluates `source` against a single `namespaceResolver` built from that
one snapshot
([`resolver.go:49-62`](../../../../core/capability/formula/names/resolver.go#L49-L62)).
Every identifier the expression touches — including repeated resolutions of
the same name, and every free name a stored function resolves when applied —
is looked up against that one fixed snapshot. If the store were re-queried
per identifier, a concurrent write to the project mid-evaluation could make
two references to the same name observe different values within one
`Evaluate` call; snapshotting once rules that out; determinism is not
otherwise a property of the namespace, only of the fixed input `Evaluate`
built from it.

This increment adds no clock, timestamp, or other ambient input: an
evaluation's result is a pure function of the snapshot and the source text, as
`formula.Service.EvaluateWith` already guarantees for a deterministic
`Resolver` (see [Formula's boundary and guarantees](README.md#boundary-and-guarantees)).

## Read-path isolation

`NameStore`'s contract requires that `Name` and `Names` return entries owned
by the caller — their `Schema` and `Rows` must not share backing storage with
the store's own data
([`names.go:73-85`](../../../../core/capability/formula/names/names.go#L73-L85)).
`MemoryStore` satisfies this by deep-copying `Schema` and `Rows` on every read
via `cloneEntry`
([`memory.go:49-57`](../../../../core/capability/formula/names/memory.go#L49-L57)),
reusing the same `cloneColumns`/`cloneRows` helpers `SetTable` uses on write.
A caller that mutates a `Get`/`List` result — or an evaluator that reconstructs
a table from a resolved snapshot — can never corrupt what a later read or
evaluation observes.

## Wired: HTTP surface, storage, and authorization

The name manager is served over HTTP and persisted in SQLite. Its
`names.NameStore` is implemented by `*sqlite.Store`
([`core/platform/storage/sqlite/sqlite.go`](../../../../core/platform/storage/sqlite/sqlite.go))
over a `formula_names` table, primary-keyed on `(project_id, name)`; `Entry`'s
`CreatedAt`/`UpdatedAt` are stamped there, not by the clock-free `Manager` —
`PutName` preserves the original `created_at` on an update while advancing
`updated_at`. The HTTP endpoints live in
[`core/handlers/name`](../../../../core/handlers/name/) and are registered on
`transport`'s gated group (any signed-in user, not the project-scoped group
that requires a *selected* project) whenever `wiring` supplies a
`*names.Manager` on `transport.Options.Names`; `wiring` constructs it as
`names.New(store, formula.NewService())` over the same durable store every
other resource uses.

Every route is scoped by the `:projectID` path parameter and authorizes the
caller against *that* project directly — via the new
`access.MembershipRole(userID, projectID)` — rather than the session's
currently selected project, since a caller may act on a project's names
without it being their current selection:

| Method & path | Handler | Auth | Body → response |
|---|---|---|---|
| `GET /projects/:projectID/names` | `List` | any member (read/edit/owner) | → `200 {"names": [entryView, ...]}` |
| `GET /projects/:projectID/names/:name` | `Get` | any member | → `200 entryView`; `404` if absent |
| `DELETE /projects/:projectID/names/:name` | `Delete` | edit/owner | → `200 {"status":"deleted"}`; `404` if absent |
| `PUT /projects/:projectID/names/:name/value` | `SetValue` | edit/owner | body is a `formula.Value` JSON scalar → `200 {"status":"set"}` |
| `POST /projects/:projectID/names/:name/table` | `CreateTable` | edit/owner | body `{"columns":[{name,type}...]}` → `201 {"status":"created"}`; `409` if the name already exists |
| `PUT /projects/:projectID/names/:name/table` | `SetTable` | edit/owner | body `{"columns":[{name,type}...], "rows":[[formula.Value,...],...]}` → `200 {"status":"set"}` |
| `PUT /projects/:projectID/names/:name/function` | `SetFunction` | edit/owner | body `{"source":"FUNCTION(...)"}` → `200 {"status":"set"}` |
| `POST /projects/:projectID/names/:name/columns` | `AddColumn` | edit/owner | body `{name,type}` (a `names.Column`) → `200 {"status":"set"}` |
| `POST /projects/:projectID/names/:name/rows` | `AppendRows` | edit/owner | body `{"rows":[[formula.Value,...],...]}` → `200 {"status":"set"}` |
| `POST /projects/:projectID/evaluate` | `Evaluate` | any member | body `{"source":"..."}` → `200 {"value": formula.Value}` |

`POST .../table` (`CreateTable`) and `PUT .../table` (`SetTable`) share a path
but differ in intent: `CreateTable` only ever builds a fresh, empty table,
failing with `ErrNameExists`/`409` if the name is already taken, while
`SetTable` always succeeds by replacing whatever was there — including a
non-table entry. A build that walks `CreateTable` → `AddColumn` →
`AppendRows` can therefore never silently clobber an existing name, unlike one
that starts from `SetTable`.

`AddColumn` and `AppendRows` are each an atomic store read-modify-write: the
`Manager` calls `NameStore.UpdateName` with a callback that reads the current
entry, validates and transforms it, and returns the result to be written, all
inside one store-level transaction (`MemoryStore` under its mutex; the SQLite
`Store` inside a `BEGIN IMMEDIATE` transaction). Because the read and the write
can no longer straddle a race with another caller's write to the same name,
concurrent mutations to the same table — two `AddColumn` calls, or an
`AddColumn` racing an `AppendRows` — cannot lose an update the way a separate
`Name` read followed by a `PutName` write could.

"any member" means a `read`, `edit`, or `owner` role may call it (evaluation
only reads the namespace); "edit/owner" means a `read` member is refused with
`403` (`authorizeWrite` in `name.go`), the same read/write split
`document.canWrite` enforces elsewhere. A non-member (or a project that does
not exist — the two are indistinguishable to a non-member) gets `403` from
every route. `entryView` is `Entry`'s tagged-union shape on the wire: it
always carries `name`, `type`, `createdAt`, `updatedAt`, plus whichever of
`value` (a scalar's `formula.Value`), `columns`/`rows` (a table's schema and
cells), or `source` (a function's text) its `type` populates. A `formula.Value`
on the wire is its canonical JSON — e.g.
`{"kind":"number","shape":{"fields":1,"rows":1},"number":"42"}` — the same
shape `MarshalJSON`/`UnmarshalJSON` define in
[`value.go`](../../../../core/capability/formula/value.go). Every
`names.Manager` failure maps through `mapErr`: `ErrNotFound`→404,
`ErrNameExists`/`ErrNotATable`→409, the remaining validation sentinels
(`ErrReservedName`, `ErrInvalidName`, `ErrTypeMismatch`, etc.)→400 with a safe
message, and a `*formula.FormulaError` (from `SetFunction`'s parse or
`Evaluate`'s parse-or-run failure)→400 with both the message and its
machine-readable `Kind`. A live walkthrough of the whole surface — set a
scalar and evaluate against it, set a table and `SUM` one of its columns,
append rows, add a column, set and call a function, get, list, delete, and the
reserved-name/read-role negative cases — is in
[`dev-test/names/run.sh`](../../../../dev-test/names/run.sh).

## Current limitation

There is no versioning or audit trail beyond the single `createdAt`/`updatedAt`
pair on each entry.
