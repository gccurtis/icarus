# 0022 — Formula name manager core

`core/capability/formula/names` is a new package: a per-project namespace of
stored scalars, tables, and functions that a Formula expression can be
evaluated against, built over the `formula.Resolver` port
[record 0021](0021-formula-functions.md) added ahead of any concrete consumer.
`formula` gains two small, additive exported helpers the new package needs;
`formula` itself is otherwise untouched. Landed across four commits
(`c77209a..4e9da78`), delivered as a stack: types + store port + in-memory
store → setters with validation → resolver + evaluate → a read-path aliasing
fix.

This is Increment 2 of 4 in the design (Increment 1 was user-defined
functions). The dependency direction is fixed and one-way: `names` imports
`formula`; `formula` never imports `names`. This increment is **library-only
and unwired** — no HTTP handler, route, or persistence. `MemoryStore` is the
only `NameStore` today; a durable SQLite-backed store, timestamps, and
transport/wiring are later increments. Constructive table operations
(`CreateTable`, `AddColumn`, `AppendRows`) are also deferred; `SetTable` only
replaces a table wholesale.

Design decisions, stated explicitly:

- **Deterministic; no clock or timestamps.** An `Entry` carries no created/
  updated time and the manager consults no clock. `Manager.Evaluate` lists a
  project's entries exactly once into a snapshot and evaluates against that
  one snapshot, so an evaluation's result is a pure function of the snapshot
  and the source text — the same determinism guarantee `formula.Service`
  already gives a fixed `Resolver`.
- **Reuses the `Resolver` port unchanged.** `namespaceResolver` implements
  `formula.Resolver` exactly as it stood after record 0021; no evaluator
  change was needed to plug a stored namespace in behind it.
- **A function is stored as source, never as a value.** `SetFunction` stores
  only the exact `FUNCTION`/`LAMBDA` source text. A function value is never
  permitted inside a table cell at any nesting depth — `containsFunction`
  rejects it with `ErrFunctionInCell` regardless of the column's declared
  type — because a function's real payload (its captured lexical scope) is
  not serializable, the same reasoning record 0021 gave for rejecting
  function values in JSON decode.
- **The read path returns caller-owned copies.** `NameStore.Name`/`Names` must
  return entries whose `Schema`/`Rows` share no backing storage with the
  store's own data. `MemoryStore` enforces this by deep-copying on every read,
  so a caller mutating a returned `Entry` — or an evaluator reconstructing a
  table from a resolved snapshot — can never corrupt what a later read or
  evaluation observes.

## `core/capability/formula/syntax.go`

### `IsIdentifier`

```go
// IsIdentifier reports whether s is a legal Formula identifier — the same rule
// as a field name (a letter or underscore, then letters, digits, or
// underscores). Name-manager entry and column names must satisfy it so they are
// referenceable from an expression.
func IsIdentifier(s string) bool {
	return validFieldName(s)
}
```

**What / goal / why:** exports the existing `validFieldName` rule under a
public name. Goal: give the name manager one authoritative, reused definition
of "legal identifier" for both entry names and table column names, rather than
duplicating the letter/underscore-then-letter/digit/underscore rule in a new
package. Purely additive — `validFieldName` itself, and every existing caller
of it, is unchanged.

## `core/capability/formula/functions.go`

### `IsReservedName`

```go
// IsReservedName reports whether s collides with a Formula builtin or keyword,
// case-insensitively. A name manager rejects such names so, for example, SUM
// always means the builtin and null always means the literal.
func IsReservedName(s string) bool {
	upper := upperASCII(s)
	if isBuiltinCall(upper) || upper == "FUNCTION" || upper == "LAMBDA" {
		return true
	}
	switch lowerASCII(s) {
	case "true", "false", "null":
		return true
	default:
		return false
	}
}
```

**What / goal / why:** exports a case-insensitive check against the closed
builtin-call registry (`isBuiltinCall`) plus `FUNCTION`/`LAMBDA` and the
`true`/`false`/`null` keywords. Goal: let the name manager reject an entry name
that would collide with a builtin or keyword, so a stored entry can never
shadow `SUM`, `IF`, or `null` at a call site — the ambiguity that would
otherwise exist if a project could name a scalar `SUM`. Deliberately *not*
applied to table column names (see `names/manager.go` below): a column is only
ever reached through dot-field access, never as a bare identifier, so a
reserved word there is harmless. Purely additive — `isBuiltinCall` and every
existing caller are unchanged.

## `core/capability/formula/names/names.go` (new file)

### Package doc, `EntryType`, `ColumnType`, `Column`, `Entry`

```go
// EntryType is the stored type of a name-manager entry.
type EntryType string

const (
	TypeNull     EntryType = "null"
	TypeNumber   EntryType = "number"
	TypeText     EntryType = "text"
	TypeLogic    EntryType = "logic"
	TypeTable    EntryType = "table"
	TypeFunction EntryType = "function"
)
```
```go
// Entry is one stored name. Only the fields its Type needs are populated: a
// scalar sets Value; a table sets Schema and Rows; a function sets Source.
type Entry struct {
	Name   string
	Type   EntryType
	Value  formula.Value
	Schema []Column
	Rows   [][]formula.Value
	Source string
}
```

**What / goal / why:** establishes the entry type model at the center of the
package. Goal: one stored name is exactly one of six types; only the field(s)
that type needs are populated — a scalar's `Value`, a table's `Schema`/`Rows`,
a function's `Source`. There is no separate `list`/`record` type: matching
`formula`'s own model (a list is a one-field table, a record is a one-row
table over the same rectangular carrier), a stored "list" or "record" is just
a `TypeTable` entry with a one-column schema or a one-row body, respectively.

### Sentinel errors and the `NameStore` port

```go
var (
	ErrNotFound          = errors.New("name not found")
	ErrReservedName      = errors.New("name collides with a builtin or keyword")
	ErrInvalidName       = errors.New("name must be a valid identifier")
	ErrNotScalar         = errors.New("value is not a scalar (number, text, logic, or null)")
	ErrInvalidColumnType = errors.New("column type must be number, text, logic, or table")
	ErrDuplicateColumn   = errors.New("duplicate column name")
	ErrTypeMismatch      = errors.New("cell does not match its column type")
	ErrRaggedRow         = errors.New("row width does not match the schema")
	ErrFunctionInCell    = errors.New("a stored value may not contain a function")
	ErrNotAFunction      = errors.New("source is not a FUNCTION or LAMBDA definition")
)
```
```go
// NameStore persists name-manager entries, keyed by (project, name).
//
// Name and Names return entries owned by the caller: the Schema and Rows they
// carry must not share mutable backing storage with the store's own data, so
// a caller may freely mutate a returned Entry without corrupting what a later
// Name, Names, or evaluation observes. Implementations that hold Schema/Rows
// by reference must deep-copy them before returning.
type NameStore interface {
	PutName(project string, entry Entry) error
	Name(project, name string) (Entry, error) // ErrNotFound if absent
	Names(project string) ([]Entry, error)
	DeleteName(project, name string) error // ErrNotFound if absent
}
```

**What / goal / why:** the sentinel errors give the manager's validation a
stable, `errors.Is`-checkable vocabulary, one per failure mode. Goal for the
port: keep persistence entirely behind four methods keyed by `(project,
name)`, so a durable store can be swapped in later (a wiring increment) with
no change to the manager. The doc comment states the copy-on-read contract
explicitly — this is a correctness requirement on every implementation, not
just `MemoryStore`, since a caller (or the evaluator, reconstructing a table
from a resolved snapshot) must never be able to corrupt stored data by
mutating a returned `Entry`.

### `Manager` and `New`

```go
// Manager is the per-project name manager over a store and the pure evaluator.
type Manager struct {
	store   NameStore
	formula *formula.Service
}

// New constructs a Manager. The formula service supplies the evaluation limits;
// a nil service uses formula defaults.
func New(store NameStore, service *formula.Service) *Manager {
	if service == nil {
		service = formula.NewService()
	}
	return &Manager{store: store, formula: service}
}
```

**What / goal / why:** the manager is deliberately thin — a store and a
`formula.Service`, nothing else (no clock, no cache). Goal: `New` accepts a
nil service and falls back to `formula.NewService()`'s production defaults,
so a caller who does not need custom limits does not have to construct one.

## `core/capability/formula/names/memory.go` (new file)

### `MemoryStore` and `cloneEntry`

```go
// MemoryStore is an in-memory NameStore, safe for concurrent use. It backs tests
// and the package until a durable store is wired.
type MemoryStore struct {
	mu       sync.Mutex
	projects map[string]map[string]Entry // project -> name -> entry
}
```
```go
// cloneEntry returns a copy of entry whose Schema and Rows do not share
// backing storage with the original, so a caller may freely mutate the
// returned Entry without corrupting the store. Value is immutable and needs
// no copy.
func cloneEntry(entry Entry) Entry {
	entry.Schema = cloneColumns(entry.Schema)
	entry.Rows = cloneRows(entry.Rows)
	return entry
}
```

**What / goal / why:** a `sync.Mutex`-guarded `project -> name -> Entry` map
implementing `NameStore` — the only implementation this increment ships, and
a stand-in until a durable store lands. `Name` and `Names` both route their
result through `cloneEntry` before returning, satisfying the port's
copy-on-read contract by reusing the same `cloneColumns`/`cloneRows` helpers
`manager.go`'s `SetTable` uses on write, so read and write paths agree on what
"isolated" means. `Value` needs no copy because `formula.Value` is already
immutable.

## `core/capability/formula/names/manager.go` (new file)

### `SetScalar`

```go
// SetScalar stores a scalar (number, text, logic, or null) under name.
func (m *Manager) SetScalar(project, name string, value formula.Value) error {
	if err := m.validateName(name); err != nil {
		return err
	}
	var kind EntryType
	switch value.Kind() {
	case formula.KindNull:
		kind = TypeNull
	case formula.KindNumber:
		kind = TypeNumber
	case formula.KindText:
		kind = TypeText
	case formula.KindLogic:
		kind = TypeLogic
	default:
		return ErrNotScalar
	}
	return m.store.PutName(project, Entry{Name: name, Type: kind, Value: value})
}
```

**What / goal / why:** validates the name, then maps the value's `Kind()` onto
one of the four scalar `EntryType`s; a structured or function value is
rejected with `ErrNotScalar`. Goal: `SetScalar` is the only setter for the four
scalar kinds, keeping "what type is this entry" derived from the value itself
rather than an argument a caller could get wrong.

### `SetTable`

```go
// SetTable stores a table wholesale: its declared columns and its rows, with
// every cell type-checked against its column (null always allowed) and no
// function permitted in any cell.
func (m *Manager) SetTable(project, name string, columns []Column, rows [][]formula.Value) error {
	if err := m.validateName(name); err != nil {
		return err
	}
	if err := validateSchema(columns); err != nil {
		return err
	}
	if err := validateRows(columns, rows); err != nil {
		return err
	}
	return m.store.PutName(project, Entry{Name: name, Type: TypeTable, Schema: cloneColumns(columns), Rows: cloneRows(rows)})
}
```

**What / goal / why:** the three-stage gate for a table: entry-name
validation, then schema validation (`validateSchema`), then per-row/per-cell
validation (`validateRows`) before anything is stored. Goal: reject a
malformed table atomically — no partial write — and store the manager's own
copies of `columns`/`rows` so a caller's later mutation of the slices it
passed in cannot alter what was stored. This is a full replace, not an
append/merge; incremental construction (`CreateTable`/`AddColumn`/
`AppendRows`) is deferred to a later increment.

### `SetFunction`

```go
// SetFunction stores a function from its source, which must parse as a
// FUNCTION/LAMBDA definition. Free identifiers are resolved later, against the
// namespace, when the function is applied.
func (m *Manager) SetFunction(project, name, source string) error {
	if err := m.validateName(name); err != nil {
		return err
	}
	expression, err := m.formula.Parse(source)
	if err != nil {
		return err
	}
	if expression.Root == nil || expression.Root.Type != formula.NodeFunction {
		return ErrNotAFunction
	}
	return m.store.PutName(project, Entry{Name: name, Type: TypeFunction, Source: source})
}
```

**What / goal / why:** parses `source` and requires its root to be a bare
`NodeFunction` — a `FUNCTION`/`LAMBDA` definition and nothing else — rejecting
any other valid-but-wrong-shaped expression (`"1 + 2"`) with `ErrNotAFunction`.
Goal: only the source text is ever stored for a function, never a value; a
function value cannot be reconstructed from persisted state without
re-evaluating its definition, since its real payload (the captured lexical
scope) does not survive serialization — the same fact record 0021 already
established for a `function` value's JSON encoding.

### `validateName`

```go
func (m *Manager) validateName(name string) error {
	if !formula.IsIdentifier(name) {
		return ErrInvalidName
	}
	if formula.IsReservedName(name) {
		return ErrReservedName
	}
	return nil
}
```

**What / goal / why:** the one path every setter routes an entry name through:
identifier shape first, then the reserved-word check. Goal: guarantee an entry
name is always both a legal identifier and not a builtin/keyword, so `SUM`
always means the aggregate and `null` always means the literal — no stored
entry can shadow either.

### `validateSchema`

```go
func validateSchema(columns []Column) error {
	seen := make(map[string]bool, len(columns))
	for _, column := range columns {
		if !formula.IsIdentifier(column.Name) {
			return ErrInvalidName
		}
		if !validColumnType(column.Type) {
			return ErrInvalidColumnType
		}
		if seen[column.Name] {
			return ErrDuplicateColumn
		}
		seen[column.Name] = true
	}
	return nil
}
```

**What / goal / why:** checks every column's name is a legal identifier and
its type is one of the four `ColumnType`s, and rejects a duplicate column
name. Goal, and the deliberate contrast with `validateName`: a column name is
checked against `IsIdentifier` only — **never** `IsReservedName`. A column
named `Sum` or `Table` is allowed, because a column is only ever reached
through dot-field access (`people.Sum`), never resolved as a top-level
identifier, so the ambiguity `IsReservedName` guards against for entry names
does not exist for columns.

### `validateRows`, `cellMatches`, `containsFunction`

```go
func validateRows(columns []Column, rows [][]formula.Value) error {
	for _, row := range rows {
		if len(row) != len(columns) {
			return ErrRaggedRow
		}
		for i, cell := range row {
			if containsFunction(cell) {
				return ErrFunctionInCell
			}
			if !cellMatches(columns[i].Type, cell) {
				return ErrTypeMismatch
			}
		}
	}
	return nil
}
```
```go
// containsFunction reports whether a value is, or nests, a function — which may
// never be stored (functions are not serializable).
func containsFunction(v formula.Value) bool {
	switch v.Kind() {
	case formula.KindFunction:
		return true
	case formula.KindList:
		items, _ := v.Items()
		for _, item := range items {
			if containsFunction(item) {
				return true
			}
		}
	case formula.KindRecord:
		_, values, _ := v.Fields()
		for _, value := range values {
			if containsFunction(value) {
				return true
			}
		}
	case formula.KindTable:
		table, _ := v.Table()
		for _, row := range table.Rows() {
			for _, cell := range row {
				if containsFunction(cell) {
					return true
				}
			}
		}
	}
	return false
}
```

**What / goal / why:** every row's width must match the schema
(`ErrRaggedRow`); every cell is checked, in order, for a nested function
first (`containsFunction`, recursing through lists, records, and tables at
any depth) and then for its declared type (`cellMatches`, which allows `null`
unconditionally and accepts `KindTable`/`KindList`/`KindRecord` for a
`ColumnTable` column). Goal: **a function may never be stored as a cell, at
any nesting depth, regardless of the column's declared type** — checked ahead
of, and independent from, the column-type check, so a `ColumnTable` column
(which would otherwise accept any table-shaped value) cannot become a
back-door for storing a function nested inside a list or record.

### `cloneColumns`, `cloneRows`

```go
func cloneColumns(columns []Column) []Column {
	return append([]Column(nil), columns...)
}

func cloneRows(rows [][]formula.Value) [][]formula.Value {
	out := make([][]formula.Value, len(rows))
	for i, row := range rows {
		out[i] = append([]formula.Value(nil), row...)
	}
	return out
}
```

**What / goal / why:** shallow-copies the column slice and each row slice into
new backing arrays. Goal: one pair of helpers shared by `SetTable` (write
path, copying the caller's input before storing) and `memory.go`'s
`cloneEntry` (read path, copying the store's data before returning it), so
both directions of the copy-on-read/copy-on-write contract use identical
logic.

## `core/capability/formula/names/resolver.go` (new file)

### `namespaceResolver` and `Resolve`

```go
// namespaceResolver resolves identifiers against an immutable snapshot of a
// project's entries, reconstructing each into a formula Value on demand. It
// implements formula.Resolver — the seam between the name manager and the pure
// evaluator.
type namespaceResolver struct {
	entries map[string]Entry
	formula *formula.Service
}

// Resolve reconstructs the named entry into a value, or reports it absent.
func (r *namespaceResolver) Resolve(name string) (formula.Value, bool, error) {
	entry, ok := r.entries[name]
	if !ok {
		return formula.Value{}, false, nil
	}
	value, err := reconstruct(r.formula, entry)
	if err != nil {
		return formula.Value{}, false, err
	}
	return value, true, nil
}
```

**What / goal / why:** the concrete `formula.Resolver` implementation over a
fixed `map[string]Entry` snapshot — reconstructing lazily, on each `Resolve`
call, rather than eagerly converting every entry up front. Goal: this is the
entire seam between the name manager and the pure evaluator; no other change
to `formula` was needed to plug a stored namespace into `EvaluateWith`,
because the `Resolver` port already existed unchanged from record 0021.

### `reconstruct`

```go
// reconstruct turns a stored entry into a formula Value: a scalar is its value;
// a table is a table value built from its schema and rows; a function is
// produced by evaluating its source. A function definition resolves no free
// names, so it needs no bindings here — its free names resolve later, when it is
// applied against the namespace.
func reconstruct(service *formula.Service, entry Entry) (formula.Value, error) {
	switch entry.Type {
	case TypeNull, TypeNumber, TypeText, TypeLogic:
		return entry.Value, nil
	case TypeTable:
		fields := make([]string, len(entry.Schema))
		for i, column := range entry.Schema {
			fields[i] = column.Name
		}
		return formula.TableValue(fields, entry.Rows)
	case TypeFunction:
		return service.Evaluate(entry.Source, nil)
	default:
		return formula.Value{}, ErrNotFound
	}
}
```

**What / goal / why:** the one place an `Entry` becomes a `formula.Value`. A
scalar entry's stored value is returned directly. A table entry always
becomes `formula.TableValue(fields, rows)` — a `KindTable` value, never
`KindList`/`KindRecord` — so a stored "list" or "record" reconstructs as a
table too; a column of it still reads back as a list through ordinary
dot-field access, so `SUM(people.score)` works unchanged. A function entry is
reconstructed by evaluating its own source with `nil` bindings, which is safe
specifically because evaluating a bare `FUNCTION`/`LAMBDA` definition builds
a closure without resolving any free identifier in its body — that resolution
happens later, when the reconstructed function value is *applied*, against
whichever resolver the applying evaluation is using.

### `Manager.Evaluate`

```go
// Evaluate evaluates source against the project's namespace and returns the
// resulting value. The namespace is snapshotted once, so evaluation is
// deterministic even as the underlying store changes.
func (m *Manager) Evaluate(project, source string) (formula.Value, error) {
	entries, err := m.store.Names(project)
	if err != nil {
		return formula.Value{}, err
	}
	index := make(map[string]Entry, len(entries))
	for _, entry := range entries {
		index[entry.Name] = entry
	}
	return m.formula.EvaluateWith(source, &namespaceResolver{entries: index, formula: m.formula})
}
```

**What / goal / why:** lists the project's entries exactly once, indexes them
by name, and evaluates `source` against a single `namespaceResolver` built
from that one snapshot — never re-querying the store mid-evaluation. Goal:
determinism. Because a stored function's free names resolve late against
*this same* resolver when applied (mutual references between two stored
functions work for this reason, exercised by `TestEvaluateAgainstNamespace`),
every identifier the expression touches — direct references and every
function-application free-name lookup — sees the identical snapshot, so two
references to the same name cannot observe different values within one
`Evaluate` call even if the store is concurrently written elsewhere.

## Tests & docs

`manager_test.go` (`TestSettersAndValidation`, `TestGetReturnsIsolatedCopy`)
covers name/schema/type validation, the function-in-cell rejection, and the
read-path copy contract. `resolver_test.go`
(`TestEvaluateAgainstNamespace`) covers scalar, table, and function
resolution, a function referencing another stored scalar, mutual reference
between two stored functions, `unknown_identifier` for a missing name, and
namespace isolation between projects.
`docs/architecture/capabilities/formula/name-manager.md` (new) documents the
shipped package and states plainly that it is library-only and unwired this
increment; `README.md` links it alongside the other companion pages. All six
`.go.md` companions (`formula/syntax.go.md`, `formula/functions.go.md`, and
the four `names/*.go.md` files) were kept byte-verbatim with their `.go`
sources.
