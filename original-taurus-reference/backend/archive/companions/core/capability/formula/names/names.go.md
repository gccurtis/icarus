# names.go

`names.go` is the entry point of the `names` package: the formula name manager, a
per-project namespace of stored scalars, tables, and functions that an expression
is evaluated against. It sits above the pure `formula` evaluator — it imports
`formula` for the `Value` model, parsing, and the `Resolver` port, while `formula`
never imports it, keeping the dependency strictly one-directional.

This file declares the vocabulary the rest of the package works with: the stored
entry types and column types, the `Entry` and `Column` shapes, the sentinel errors
every operation reports, the `NameStore` persistence port, and the `Manager` type
with its constructor. Later files (`memory.go`, `manager.go`, `resolver.go`) add
the in-memory store, the setters and validation, and evaluation against the
namespace — but the types and errors they all share live here.

## Code breakdown

### Package documentation and imports

```go
// Package names is the formula name manager: a per-project namespace of stored
// values and functions that an expression is evaluated against. It is the state
// layer over the pure formula evaluator — it imports formula (for the Value
// model, parsing, and the Resolver port) but formula never imports it.
//
// Every entry has one type. Scalars (number, text, logic, null) store their
// value; a function stores its source text; a table stores its declared column
// schema and its rows. A list and a record are just tables (a one-field and a
// one-row table). The manager reconstructs each entry into a formula Value and
// resolves identifiers for the evaluator.
package names

import (
	"errors"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/formula"
)

```

The package comment states the two facts that shape every design choice in the
package: it is a state layer over the pure evaluator, and the import direction is
one-way. It also previews the entry model — scalars, tables, and functions are the
only stored shapes, and a list or record is just a table with one field or one
row — which is why `EntryType` below has no separate `list` or `record` case.

### Entry types

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

`EntryType` is a string enum naming the six shapes a stored name can take: the four
scalar kinds that mirror `formula.Kind` (null, number, text, logic), plus `table`
and `function`. There is no `list` or `function`-in-cell type here because those
are represented as tables and rejected in cells respectively — see `manager.go`.

### Column types

```go
// ColumnType is the declared type of a table column: a scalar kind or a nested
// table. A cell must match it; null is always allowed.
type ColumnType string

const (
	ColumnNumber ColumnType = "number"
	ColumnText   ColumnType = "text"
	ColumnLogic  ColumnType = "logic"
	ColumnTable  ColumnType = "table"
)

```

`ColumnType` is the parallel enum for a table's declared column schema. It has no
`null` case — null is not a column type to declare, it is a value any column
always accepts, a rule enforced in `manager.go`'s `cellMatches`.

### Column and Entry

```go
// Column is one declared table column.
type Column struct {
	Name string     `json:"name"`
	Type ColumnType `json:"type"`
}

// Entry is one stored name. Only the fields its Type needs are populated: a
// scalar sets Value; a table sets Schema and Rows; a function sets Source.
// CreatedAt and UpdatedAt are stamped by the store, not the Manager, which stays
// clock-free and deterministic.
type Entry struct {
	Name      string
	Type      EntryType
	Value     formula.Value
	Schema    []Column
	Rows      [][]formula.Value
	Source    string
	CreatedAt time.Time
	UpdatedAt time.Time
}

```

`Column` pairs a declared name with its type — the unit `SetTable`'s schema
parameter is built from; its JSON tags let it ride directly on the wire as a
handler request/response field. `Entry` is the one stored-name shape the whole
package passes around: rather than a type per kind, it is a tagged union in Go's
usual style — `Type` says which of `Value`, `Schema`/`Rows`, or `Source` is
meaningful, and the others are left zero. This keeps `NameStore` a single narrow
interface instead of one per entry kind. `CreatedAt` and `UpdatedAt` are carried
on the type but deliberately left unset by every `Manager` method — the Manager
stays clock-free and deterministic, and it is the store (the SQLite
implementation) that stamps them, the same separation of concerns as `Project`'s
timestamps in the access layer.

### Sentinel errors

```go
// Sentinel errors from the manager and its store.
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
	ErrNameExists        = errors.New("name already exists")
	ErrNotATable         = errors.New("name does not hold a table")
)

```

Every failure the package can report is one of these twelve sentinels, checked
with `errors.Is` by callers and tests alike. `ErrNotFound` covers a missing name
in the store; `ErrReservedName` and `ErrInvalidName` are the two ways a name
itself can be rejected (Task 1's `formula.IsReservedName` / `IsIdentifier`); most
of the rest are `SetScalar`/`SetTable`/`SetFunction` validation failures; and
`ErrNameExists` / `ErrNotATable` guard the constructive builders
(`CreateTable` / `AddColumn` / `AppendRows`) — all implemented in `manager.go`.

### NameStore

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
	// UpdateName atomically reads an entry, applies mutate, and writes the
	// result in one transaction, so concurrent read-modify-write callers cannot
	// lose an update. It returns ErrNotFound if the entry is absent, or mutate's
	// error (leaving the stored entry unchanged).
	UpdateName(project, name string, mutate func(Entry) (Entry, error)) error
}

```

`NameStore` is the persistence port: every operation is scoped by a `project`
string, so one store instance holds every project's namespace while keeping them
isolated from each other. `memory.go` provides the only implementation this
increment needs; a durable store drops in later behind the same five methods.
The doc comment on `Name`/`Names` states the ownership contract that makes the
read side symmetric with `SetTable`'s write-side cloning: a returned `Entry` is
the caller's to mutate freely, so `memory.go`'s `Name` and `Names` return a
`cloneEntry` copy rather than the store's own `Schema`/`Rows` slices, and a
future SQLite store must honor the same rule. `UpdateName` adds an atomic
read-modify-write to the port: `AddColumn` and `AppendRows` (`manager.go`) call
it with a `mutate` callback instead of a separate `Name` read followed by
`PutName`, so the read and the write can no longer straddle a race with another
caller's write to the same name — `MemoryStore` runs it under its single mutex,
and the SQLite `Store` runs it inside one `BEGIN IMMEDIATE` transaction.

### Manager and its constructor

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

`Manager` is the package's one public entry point: it pairs a `NameStore` with a
`formula.Service`, the latter supplying parsing, evaluation, and the limits that
bound both. `New` is the only constructor and defaults a nil service to
`formula.NewService()`, so callers who don't need custom limits can pass `nil` and
still get a working manager. The setters and accessors (`manager.go`) and
evaluation against the namespace (`resolver.go`) are all methods on this type.
