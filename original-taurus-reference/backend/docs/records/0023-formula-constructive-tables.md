# 0023 — Formula name manager: constructive table building

The name manager gained three methods for building a table up incrementally
rather than only writing it whole: `CreateTable` makes an empty typed table,
`AddColumn` widens it, and `AppendRows` extends it — each reusing the schema and
type-enforcement helpers already in place. This closes the "declare headers and
their types, then add rows/columns" gap; a `table` entry is still stored as a
schema plus a rectangular row set, so these are ordinary edits to that shape.

The wholesale `SetTable` remains for replacing an entry in one call. Row/column
deletion is deliberately not built yet.

## `core/capability/formula/names/names.go`

### Two new sentinels

```go
// ErrNameExists guards CreateTable; ErrNotATable guards AddColumn/AppendRows.
```

**What / goal / why:** `ErrNameExists` lets `CreateTable` refuse to clobber an
existing name (a constructive build should start from nothing, not silently
overwrite), and `ErrNotATable` lets the two mutators reject a name that holds a
scalar or function. Both are `errors.Is`-checkable like the package's other
sentinels.

## `core/capability/formula/names/manager.go`

### CreateTable — start an empty typed table

```go
func (m *Manager) CreateTable(project, name string, columns []Column) error
```

**What / goal / why:** validates the name and schema exactly as `SetTable` does,
then confirms the name is free (a nil error from `Name` means taken → `ErrNameExists`;
any non-`ErrNotFound` error is a real store failure) before writing a table with
no rows. The declared column types exist before any data, so an empty typed
column still has a type — the whole point of building constructively.

### AddColumn — widen an existing table

```go
func (m *Manager) AddColumn(project, name string, column Column) error
```

**What / goal / why:** loads the table (via `loadTable`), checks the new column's
name/type and non-duplication, then appends the column to the schema and a
`NullValue` to every existing row so the table stays rectangular. It is a
read-modify-write over `Name`+`PutName`, so a caller must be the single writer
for a given name until the store gains a transactional update — noted here and
in the method doc so the SQLite/wiring increment can address it.

### AppendRows — extend an existing table

```go
func (m *Manager) AppendRows(project, name string, rows [][]formula.Value) error
```

**What / goal / why:** loads the table and type-checks the incoming rows against
its current schema with the same `validateRows` the wholesale path uses, then
stores the existing rows followed by cloned copies of the new ones. Cloning both
sides keeps the stored entry and the caller's slices from aliasing the result.

### loadTable — shared table fetch

```go
func (m *Manager) loadTable(project, name string) (Entry, error)
```

**What / goal / why:** the common preamble for `AddColumn`/`AppendRows` —
propagates `ErrNotFound` for a missing name and returns `ErrNotATable` for a
scalar/function entry, so the mutators only ever touch an actual table.

## Tests

`TestConstructiveTableBuilding` covers the full arc: create (and create-over-
existing → `ErrNameExists`), append (and a type-mismatched append →
`ErrTypeMismatch`), add a column (existing rows gain nulls; `COLUMNS` grows;
duplicate → `ErrDuplicateColumn`), append against the widened schema, and the
`ErrNotATable`/`ErrNotFound` guards. The `manager.go`/`names.go` companion docs
are updated verbatim.
