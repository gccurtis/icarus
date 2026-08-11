# manager.go

`manager.go` adds the `Manager`'s writing and reading surface: the three setters
(`SetScalar`, `SetTable`, `SetFunction`), the three plain accessors (`Get`, `List`,
`Delete`), and the unexported validation helpers they all lean on. Every setter
runs the same shape of check before it ever touches the store — validate the name,
validate the shape of what's being stored, then `PutName` — so a caller either gets
a fully valid entry or one of the sentinel errors from `names.go`, never a
partially-written one.

The validation helpers enforce the two structural rules the package cares about: a
table's schema and rows must agree (types, arity, no duplicate column names), and
no stored value may contain a function anywhere within it, since a function is not
serializable — only its source text is stored, in the `Source` field of a
`function`-typed `Entry`.

## Code breakdown

### Package declaration and import

```go
package names

import (
	"errors"

	"github.com/gccurtis/taurus-omega/core/capability/formula"
)

```

The file needs `formula`, for `Value`, its `Kind` constants, `IsIdentifier`,
`IsReservedName`, and the parser's `NodeFunction` type; and `errors`, for the
`errors.Is` check `CreateTable` runs against `ErrNotFound`.

### SetScalar

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

`SetScalar` validates the name first, then maps the value's `formula.Kind` onto
the matching `EntryType` — the four scalar kinds it recognizes. Anything else
(list, record, table, function) falls to the `default` case and is rejected as
`ErrNotScalar`, since a scalar entry can only ever hold one of the four leaf
kinds. Once a kind is chosen, the whole value is handed to the store unchanged.

### SetTable

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

`SetTable` runs three checks in order — the entry name, then the schema on its
own, then the rows against that schema — before storing anything, so a caller
learns about a bad schema even if the rows would otherwise be fine. It stores
defensive copies of both `columns` and `rows` (`cloneColumns`/`cloneRows`) so the
caller's slices can be mutated afterward without reaching into the stored entry.

### SetFunction

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

`SetFunction` parses the source with the manager's `formula.Service` and checks
the parsed root is a `NodeFunction` — the node `FUNCTION(...)`/`LAMBDA(...)`
produce — rejecting anything else (a plain expression like `1 + 2`, for example)
as `ErrNotAFunction`. A genuine parse failure (unbalanced parens, and so on)
propagates as-is, so the caller sees the underlying `formula.FormulaError` rather
than a name-manager sentinel. Only the source text is stored; the function's free
identifiers (like a reference to another stored name) are left unresolved until
it is applied, which is what lets two stored functions call each other — see
`resolver.go`.

### CreateTable

```go
// CreateTable creates a new, empty table with the given columns. It fails with
// ErrNameExists if the name is already taken, so a constructive build never
// silently clobbers an existing entry; use SetTable to replace one wholesale.
func (m *Manager) CreateTable(project, name string, columns []Column) error {
	if err := m.validateName(name); err != nil {
		return err
	}
	if err := validateSchema(columns); err != nil {
		return err
	}
	if _, err := m.store.Name(project, name); err == nil {
		return ErrNameExists
	} else if !errors.Is(err, ErrNotFound) {
		return err
	}
	return m.store.PutName(project, Entry{Name: name, Type: TypeTable, Schema: cloneColumns(columns)})
}

```

`CreateTable` is the constructive counterpart to `SetTable`: it validates the
name and schema the same way, but then checks the name is free — a nil error from
`Name` means it is taken (`ErrNameExists`), and any error other than `ErrNotFound`
is a real store failure — before writing an empty table (no rows). This is what
lets a build proceed column-by-column and row-by-row without a wholesale write
ever silently overwriting an existing entry.

### AddColumn

```go
// AddColumn appends a typed column to an existing table, giving every existing
// row a null cell in the new column. It is a read-modify-write over the store,
// so a caller must be the single writer for a given name until a transactional
// store lands.
func (m *Manager) AddColumn(project, name string, column Column) error {
	if !formula.IsIdentifier(column.Name) {
		return ErrInvalidName
	}
	if !validColumnType(column.Type) {
		return ErrInvalidColumnType
	}
	return m.store.UpdateName(project, name, func(entry Entry) (Entry, error) {
		if entry.Type != TypeTable {
			return Entry{}, ErrNotATable
		}
		for _, existing := range entry.Schema {
			if existing.Name == column.Name {
				return Entry{}, ErrDuplicateColumn
			}
		}
		schema := append(cloneColumns(entry.Schema), column)
		rows := cloneRows(entry.Rows)
		for i := range rows {
			rows[i] = append(rows[i], formula.NullValue())
		}
		return Entry{Name: name, Type: TypeTable, Schema: schema, Rows: rows}, nil
	})
}

```

`AddColumn` checks the new column's name and type up front, then hands the rest
to `m.store.UpdateName`: the `mutate` callback runs against the current entry,
rejecting a missing name (`UpdateName` returns `ErrNotFound` before `mutate` is
even called) or a non-table (`ErrNotATable`), checks the column doesn't
duplicate an existing one, then widens the schema and gives every existing row a
`NullValue` in the new position — so the table stays rectangular. Moving the
read inside `UpdateName` (rather than a separate `loadTable` call followed by
`PutName`) is what makes the whole operation atomic: the store — `MemoryStore`
under its mutex, or the SQLite `Store` inside one transaction — now performs the
read, the check, and the write as a single indivisible step, so two concurrent
`AddColumn` calls on the same name can no longer race and silently drop one of
them.

### AppendRows

```go
// AppendRows appends rows to an existing table, each type-checked against the
// current schema. Like AddColumn it is a read-modify-write (single-writer).
func (m *Manager) AppendRows(project, name string, rows [][]formula.Value) error {
	return m.store.UpdateName(project, name, func(entry Entry) (Entry, error) {
		if entry.Type != TypeTable {
			return Entry{}, ErrNotATable
		}
		if err := validateRows(entry.Schema, rows); err != nil {
			return Entry{}, err
		}
		combined := append(cloneRows(entry.Rows), cloneRows(rows)...)
		return Entry{Name: name, Type: TypeTable, Schema: cloneColumns(entry.Schema), Rows: combined}, nil
	})
}

```

`AppendRows` follows the same shape as `AddColumn`: its `mutate` callback rejects
a non-table, then type-checks the new rows against the current schema with the
same `validateRows` the wholesale `SetTable` uses, then returns the existing rows
followed by copies of the new ones. Running inside `UpdateName` gives it the same
atomicity guarantee — the schema and row count `validateRows` checks against are
the ones actually being written, not a possibly-stale snapshot read earlier.

### Get, List, Delete

```go
// Get returns one entry, or ErrNotFound.
func (m *Manager) Get(project, name string) (Entry, error) { return m.store.Name(project, name) }

// List returns every entry in the project's namespace.
func (m *Manager) List(project string) ([]Entry, error) { return m.store.Names(project) }

// Delete removes one entry, or returns ErrNotFound.
func (m *Manager) Delete(project, name string) error { return m.store.DeleteName(project, name) }

```

These three accessors are direct one-line passthroughs to the underlying
`NameStore` — the `Manager` adds no behavior over `Get`/`List`/`Delete`, only the
setters need validation.

### Name validation

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

`validateName` is the one check every setter runs first: a name must be a legal
identifier (Task 1's `formula.IsIdentifier`) and must not collide with a Formula
builtin or keyword (`formula.IsReservedName`). Checking identifier shape before
reservation means an invalid name like `"has space"` is reported as
`ErrInvalidName` rather than being tested against the reserved list at all.

### Schema validation

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

`validateSchema` walks the declared columns once, checking each one's name is a
legal identifier, its type is one of the four recognized `ColumnType`s, and its
name hasn't already appeared — in that order, so the most specific applicable
error wins for a column that fails more than one check.

### Row validation

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

`validateRows` checks every row's width against the schema first — a ragged row
is rejected before any of its cells are inspected — then, cell by cell, rejects a
function before checking the type match, so a function nested in, say, a `number`
column is reported as `ErrFunctionInCell` rather than the less specific
`ErrTypeMismatch`.

### Column type membership

```go
func validColumnType(t ColumnType) bool {
	switch t {
	case ColumnNumber, ColumnText, ColumnLogic, ColumnTable:
		return true
	default:
		return false
	}
}

```

`validColumnType` is the closed set of legal `ColumnType` values — the schema
check above rejects anything outside it as `ErrInvalidColumnType`.

### Cell/column type matching

```go
// cellMatches reports whether a cell satisfies a column type. Null always fits;
// a table column accepts any table-shaped value (table, list, or record).
func cellMatches(t ColumnType, cell formula.Value) bool {
	if cell.Kind() == formula.KindNull {
		return true
	}
	switch t {
	case ColumnNumber:
		return cell.Kind() == formula.KindNumber
	case ColumnText:
		return cell.Kind() == formula.KindText
	case ColumnLogic:
		return cell.Kind() == formula.KindLogic
	case ColumnTable:
		switch cell.Kind() {
		case formula.KindTable, formula.KindList, formula.KindRecord:
			return true
		}
	}
	return false
}

```

`cellMatches` special-cases null first — null is always allowed regardless of
column type, since it means "no value" rather than a value of the wrong shape —
then matches each scalar column type against its one corresponding `formula.Kind`.
A `table` column is more permissive: it accepts any of the three structured
kinds (`KindTable`, `KindList`, `KindRecord`), since a list and a record are
themselves just tables shaped one field or one row wide.

### Function detection

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

`containsFunction` is a direct function value at the top, or recurses into every
structured kind's contents — a list's items, a record's field values, a table's
cells — since a function could be nested arbitrarily deep inside any of them
(a table whose column holds a list that holds a function, for example). Any
scalar kind (null, number, text, logic) falls through the switch and returns
false, as does a function-free structured value once every element has been
checked.

### Defensive copies

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

`cloneColumns` and `cloneRows` make independent copies of the schema and row data
`SetTable` stores, so the entry the store holds cannot be mutated through the
slices the caller passed in — the same defensive-copy discipline `formula`'s own
value model uses internally.
