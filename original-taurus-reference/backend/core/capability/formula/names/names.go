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

// ColumnType is the declared type of a table column: a scalar kind or a nested
// table. A cell must match it; null is always allowed.
type ColumnType string

const (
	ColumnNumber ColumnType = "number"
	ColumnText   ColumnType = "text"
	ColumnLogic  ColumnType = "logic"
	ColumnTable  ColumnType = "table"
)

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
