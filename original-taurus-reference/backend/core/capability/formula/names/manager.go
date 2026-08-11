package names

import (
	"errors"

	"github.com/gccurtis/taurus-omega/core/capability/formula"
)

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

// Get returns one entry, or ErrNotFound.
func (m *Manager) Get(project, name string) (Entry, error) { return m.store.Name(project, name) }

// List returns every entry in the project's namespace.
func (m *Manager) List(project string) ([]Entry, error) { return m.store.Names(project) }

// Delete removes one entry, or returns ErrNotFound.
func (m *Manager) Delete(project, name string) error { return m.store.DeleteName(project, name) }

func (m *Manager) validateName(name string) error {
	if !formula.IsIdentifier(name) {
		return ErrInvalidName
	}
	if formula.IsReservedName(name) {
		return ErrReservedName
	}
	return nil
}

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

func validColumnType(t ColumnType) bool {
	switch t {
	case ColumnNumber, ColumnText, ColumnLogic, ColumnTable:
		return true
	default:
		return false
	}
}

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
