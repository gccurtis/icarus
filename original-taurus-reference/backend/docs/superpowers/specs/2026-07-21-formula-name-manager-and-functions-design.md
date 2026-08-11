# Formula name manager & user-defined functions — design

## Goal

Give **formula** a state layer without giving up its purity. Today it is a
pure library: `formula.Service` parses and evaluates against a per-call
`Bindings` map, with a fixed set of builtins and no persistence.

This change adds three pieces, kept deliberately modular:

1. **`FUNCTION` / `LAMBDA`** — user-defined functions as a first-class value
   type in the pure evaluator.
2. **A name manager** — a *separate* per-project state module that stores named
   values and functions and resolves identifiers for the evaluator.
3. **Constructive, typed table-building** — declare a table's columns and their
   types, then add rows and columns incrementally, with the types enforced.

Document integration is explicitly **out of scope** here — it comes after.
Nothing here may regress the existing formula evaluator, its `Value` model, or
its tests (see [Compatibility](#compatibility-with-the-existing-formula)).

## Two modules, one domain, one-directional dependency

Formula and the name manager live in the same domain but stay **decoupled**, so
either can change without dragging the other:

- **`core/capability/formula`** — the pure evaluator. Deterministic,
  side-effect-free: no storage, clock, randomness, network, model, or
  cross-capability calls. It owns parsing, the `Value` model, evaluation, the
  builtins, and now `FUNCTION`/`LAMBDA`. It exposes a small **`Resolver` port**
  (below) for looking up a top-level identifier. **It never imports the name
  manager.**
- **`core/capability/formula/names`** — the name manager: a separate, wired,
  stateful package that imports formula. It stores a project's named values and
  functions, implements `Resolver` over them, and drives evaluation. It has a
  `Manager` type, a `NameStore` port, and an in-memory `memory.go`, mirroring
  the `access` capability. The concrete SQLite adapter lives in
  `platform/storage/sqlite` and is injected by `wiring`.

The dependency points one way only — `names → formula` — so formula stays a
standalone, testable, stateless capability, and the name manager is a module you
can evolve on its own. The only things crossing the seam are the `Resolver`
interface and the plain `Value` type.

### The `Resolver` port

```go
// In package formula: the evaluator's only channel for top-level identifiers.
type Resolver interface {
    Resolve(name string) (value Value, ok bool, err error)
}
```

- `Bindings` (the existing `map[string]Value`) gains a trivial `Resolve`
  method, so today's API is unchanged and backward-compatible.
- `Service.Evaluate(source, Bindings)` keeps working; a new
  `Service.EvaluateWith(source, Resolver)` takes any resolver.
- The evaluator stays pure: it is only as deterministic as the resolver it is
  handed. The name manager supplies a resolver over an immutable snapshot of the
  project's entries, so evaluation stays deterministic.

## Part 1 — `FUNCTION` / `LAMBDA` (pure evaluator)

### A new scalar type

`function` is a new value type, scalar-category (its `Shape` is 1×1, like
`number`/`text`/`logic`), added as `KindFunction` alongside `null / number /
text / logic / list / record / table`. A function value carries its **parameter
names** and its **body** (a parsed sub-expression), plus a runtime closure
(below). `LAMBDA` is a pure alias of `FUNCTION`.

### Definition

```text
FUNCTION(x, x * 2)          # one param, body
FUNCTION(a, b, a + b)       # two params, body
FUNCTION(42)                # zero params, constant body
LAMBDA(n, n * n)            # alias
```

Every argument but the last is a **bare parameter identifier**; the last
argument is the **body expression**. A non-identifier in a parameter position,
or a duplicate parameter name, is a `parse_error`. Parameter names follow the
identifier rule (same as field names). A formula is an expression that yields an
output — it never contains a persistent `name = value` assignment; naming lives
only in the name manager. (Optional future sugar: `;`-separated local
temporaries inside one expression. Not built now; the grammar has nothing like
it today.)

### Application

A new **postfix apply** operator, at the same grammar tier as `.field` and
`[index]`:

```text
FUNCTION(n, n * n)(5)          # inline lambda -> 25
apply(FUNCTION(n, n * n), 5)   # a function passed as an argument (higher-order)
compose(f, g)(x)               # chained application
some_registered_name(21)       # call a function resolved from the namespace
```

Dispatch: an `ident(` whose identifier is a **builtin** (`SUM`, `IF`, `TABLE`,
`FUNCTION`, …) is still a builtin call. Any other `ident(...)` or `(expr)(...)`
is an **apply** of the resolved value. Applying a non-function is `type_error`;
wrong argument count is `wrong_arity`.

The builtins *are* the "programmatically defined" functions; a `FUNCTION(...)`
is an **anonymous** one that only gets a name by being registered. Making a bare
builtin name evaluate to a callable value (so `SUM` could be passed around) is
**not** built now — many builtins are variadic or special forms (`IF`) that do
not fit a fixed parameter list. Deferred.

### Closures and resolution

Lexical, with late binding to the namespace:

- An inline `FUNCTION(...)` captures the **current evaluator scope**. Free
  variables in its body (identifiers that are not parameters) resolve outward
  through the scope chain, and finally through the **root `Resolver`**.
- On application, parameters bind to arguments in a new child scope; the body is
  evaluated there.
- A function registered in the name manager has **no captured local scope**; its
  free variables resolve straight through the root resolver of whatever
  evaluation calls it. So a registered `profit = FUNCTION(r, r - costs)` reads
  the current `costs` value at call time, and functions may reference one
  another (including mutual recursion). A free identifier that is neither a
  parameter nor resolvable is `unknown_identifier`.

### Safety (unchanged DoS story)

- Each application charges one step (`MaxSteps`) and deepens `depth`
  (`MaxDepth`); recursion and mutual recursion terminate against those existing
  ceilings.
- A function body is an ordinary bounded `Node` subtree, already covered by the
  iterative `validateExpression` re-validator; `FUNCTION` and apply are ordinary
  nodes counted against `MaxNodes` / `MaxDepth`.

### No serialization — on purpose

A function value is **not** serializable, and we do not try to make it so. All a
function durably *is* is a name plus its source; it only evaluates inside a
namespace that defines whatever it references.

- `MarshalJSON` emits a **display-only** descriptor
  `{ "kind": "function", "params": [...], "source": "FUNCTION(...)" }`. It is not
  round-trippable.
- `UnmarshalJSON` **rejects** `kind: function` — a closure cannot be
  reconstructed from JSON.
- A function therefore can never be persisted as a serialized value, and stored
  data may not contain a function inside a table cell.
- `Equal` compares parameter lists and canonical body source; captured values
  are not compared.

The name manager persists a function entry as its **source string**, re-parsed
on load.

## Part 2 — the name manager

### The type model

Every entry has one **type**. Types are either **scalar** or the **object**
type:

- **scalar:** `number`, `text`, `logic`, `function`.
- **object:** `table` — an ordered set of typed columns and a rectangular set of
  rows. A **list** and a **record** are *this* type (they are tables), not types
  of their own:
  - a **list** is a table with a single field, named after the entry, whose type
    is the element type;
  - a **record** is a table with named fields, each its own type — a one-row
    table. It is the one shape we alias for convenience, but it is still a table.

Within a table, each **column** has a type, and a column's type is itself either
a scalar (`number` / `text` / `logic`) or `table` — so a field may hold a nested
table. `null` is always an allowed cell value. Column types are enforced by the
**manager**, not by the pure `Value` model.

### Storage follows the type

Each entry stores only what its type needs:

```text
Entry {
  Name       string     # the identifier (unique per project across all types)
  Type       EntryType  # "number" | "text" | "logic" | "function" | "table"
  Value      *Value     # the value itself, for a scalar (number/text/logic)
  Schema     []Column   # ordered {Name, Type}, for a table (its declared columns)
  Rows       [][]Value  # the table's rows
  Source     string     # the FUNCTION(...) text, for a function
  CreatedAt, UpdatedAt time
}

Column { Name string; Type ColumnType }   # ColumnType in {number, text, logic, table}
```

- a **scalar** stores just its `Value`;
- a **function** stores just its `Source` text;
- a **table** stores its `Schema` (so declared column types survive even when a
  column is empty) and its `Rows`.

The `Schema` is the source of truth for column *types*; the `Rows` hold the
data. They are kept consistent by the manager. Cells serialize through the
existing `Value` JSON.

### Reconstruction into a binding

When the manager resolves an entry into a formula `Value` for evaluation:

| Entry type | Result |
|---|---|
| `number` / `text` / `logic` | the stored scalar `Value` |
| `function` | parsed from `Source` into a function value |
| `table` | a `KindTable` value built from `Schema` + `Rows` (a single-field table reads like a list; a one-row table promotes to a record with `!`) |

Inline `[...]` and `{...}` literals inside an expression still produce
`KindList` / `KindRecord` as they do today; those kinds are untouched in the
language. The *storage* model just presents stored structured data uniformly as
tables.

### Manager operations

Wholesale setters, one per type (you preferred separate endpoints per kind):

- `SetScalar(project, name, value)` — store a `number` / `text` / `logic` value.
- `SetTable(project, name, columns[], rows[])` — store a table wholesale; every
  cell type-checked against its column.
- `SetFunction(project, name, source)` — parse-check `source` as a `FUNCTION`,
  store it as a function entry.
- `Get`, `List`, `Delete`.

Constructive table building:

- `CreateTable(project, name, columns[])` — create a table, possibly zero rows.
  The schema exists before any data, so an empty typed column still has a type.
- `AddColumn(project, name, column{Name, Type})` — append a column; existing
  rows get `null`.
- `AppendRows(project, name, rows[])` — each row aligned to the schema; every
  cell type-checked before anything is written.
- (Follow-ups, same shape: `RemoveColumn`, `DeleteRows`.)

**Reserved names.** Registering a name that collides with a builtin
(case-insensitive) is rejected, so `SUM` always means the builtin. A stored
value containing a function inside a cell is rejected (no function
serialization).

### Evaluating against a namespace

`Evaluate(project, source)`:

1. Snapshot the project's entries and build a `Resolver` over them —
   reconstruct each scalar/table entry lazily on lookup, and parse each function
   entry's source into a function value whose free identifiers bind through the
   same resolver.
2. Call `formula.Service.EvaluateWith(source, resolver)`.
3. Return the resulting `Value` (a function result serializes display-only).

Cross-references between entries resolve here, bounded by the usual limits.

## Part 3 — HTTP surface

Gated, project-scoped, reusing the existing project-role checks (read may read;
edit/owner may mutate). Separate endpoints per kind:

```text
GET    /projects/:projectID/names                  list entries (name, type, schema, shape)
GET    /projects/:projectID/names/:name            one entry (type, value | schema+rows | function source)
DELETE /projects/:projectID/names/:name            delete an entry

PUT    /projects/:projectID/names/:name/value      { value: <scalar formula Value> }
PUT    /projects/:projectID/names/:name/table      { columns:[{name,type}], rows:[[...]] }
PUT    /projects/:projectID/names/:name/function    { source: "FUNCTION(...)" }

POST   /projects/:projectID/names/:name/columns    { name, type }        add a typed column
POST   /projects/:projectID/names/:name/rows       { rows: [ ... ] }      append rows (schema-checked)

POST   /projects/:projectID/evaluate               { source: "..." }      evaluate against the namespace
```

`GET`, `DELETE`, and the constructive `columns`/`rows` operations work on the
one namespace regardless of type; the typed `PUT` endpoints keep each type's
payload explicit. Errors are the structured `FormulaError` for parse/eval
failures and manager sentinels (unknown entry, type mismatch, reserved name,
duplicate column, function-in-cell) for the rest.

## Storage (SQLite)

One table, keyed by project + name:

```text
formula_names(
  project_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,   -- "number" | "text" | "logic" | "function" | "table"
  value       TEXT NOT NULL,   -- Value JSON for a scalar; '' otherwise
  schema      TEXT NOT NULL,   -- JSON [{name,type}] for a table; '' otherwise
  rows        TEXT NOT NULL,   -- JSON [][]Value    for a table; '' otherwise
  source      TEXT NOT NULL,   -- FUNCTION(...) text for a function; '' otherwise
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (project_id, name)
)
```

Cells serialize through the existing `Value` JSON (functions are never cells in
stored data). Migration is an idempotent `CREATE TABLE IF NOT EXISTS`, following
the existing style.

## Compatibility with the existing formula

Everything the pure evaluator gains is **additive**, so current behavior and
tests stand:

- `KindFunction` is a new arm in the value type switches (`Kind`, `Shape`,
  `Equal`, `String`, `MarshalJSON`, and the evaluator) — existing kinds are
  unchanged. `UnmarshalJSON` gains a function rejection, not a change to any
  existing kind.
- The **postfix apply** operator only gives meaning to `value(...)` /
  `(expr)(...)`, which was a parse error before; builtin-call syntax
  (`SUM(...)`, `IF(...)`) is unchanged.
- The `Resolver` port is introduced with `Bindings` implementing it and
  `Evaluate(source, Bindings)` preserved verbatim; `EvaluateWith` is the only
  new entry point. No existing call site changes.
- `list` / `record` / `table` value kinds and every existing query, projection,
  slice, and promotion semantic are untouched; the name manager is new code that
  produces ordinary `Value`s.

Each increment runs `go build`, `go vet`, `go test ./...`, and the relevant
`dev-test` suites green before it lands, and keeps `.go.md` companions verbatim.

## Non-goals (YAGNI)

- Document integration (deferred by request).
- Column types inside the pure `Value` model (enforcement stays in the manager).
- Function persistence beyond source; any closure serialization.
- Bare builtin names as first-class callable values; `;`-local temporaries.
- The `|` group-by / partition-reduce operator (still future).
- Deep enforcement of a nested table column's own schema (a `table`-typed cell
  must be table-shaped, but its inner columns are not re-checked here), entry
  versioning/history, per-entry access control finer than the project role,
  query planner / persisted table catalog.

## Build order (small, independently shippable increments)

Each increment is green (`go build`, `go vet`, `go test ./...`), updates its
`.go.md` companions in the same commit, and gets its own change record.

1. **`FUNCTION` / `LAMBDA` in the evaluator core** — `KindFunction`, parser
   (definition + postfix apply), evaluator closures, arity/type/limit checks,
   the `Resolver` port (+ `Bindings.Resolve`, `EvaluateWith`), display-only
   marshaling. Unit tests + `dev-test` formula quality suite.
2. **Name manager core** — the `formula/names` package: `Manager`, `NameStore`
   port, `memory.go`, the scalar/table/function type model, reserved-name rule,
   `Resolver` implementation, `Evaluate`-against-namespace. Unit tests with the
   in-memory store.
3. **Constructive typed tables** — `CreateTable` / `AddColumn` / `AppendRows`
   with schema enforcement (including `table`-typed columns). Unit tests.
4. **Wire the capability** — SQLite `NameStore` adapter + migration, transport
   routes, handlers, `wiring` registration. The name manager goes **wired**; the
   orientation capabilities table and architecture docs are updated; a
   `dev-test` HTTP suite drives the endpoints end to end.

## Docs & records

- New architecture pages under `docs/architecture/capabilities/formula/`: the
  functions language feature, and the name manager (state + endpoints + the
  `Resolver` seam); querying/README cross-linked.
- The orientation capabilities table records formula's evaluator as the pure
  core and the name manager as the wired state module.
- One change record per increment (next free number after `0020`), one `##` per
  file, `###` per change with what/goal/why.
- Every touched non-test `*.go` keeps its byte-verbatim `FILE.go.md` companion.
