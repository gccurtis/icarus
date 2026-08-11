# Formula Name Manager Core Implementation Plan (Increment 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `formula/names` package — a per-project namespace of stored scalars, tables, and functions that an expression is evaluated against — over the `Resolver` port added in Increment 1. No SQLite and no HTTP yet (that is Increment 4); no constructive table mutation yet (Increment 3).

**Architecture:** A new package `core/capability/formula/names` that imports `formula` (one-directional: `names → formula`; formula never imports names). It defines an `Entry` type model (scalar / table / function), a `NameStore` port with an in-memory implementation, and a `Manager` that validates and stores entries and evaluates source against the namespace by building a `namespaceResolver` (implementing `formula.Resolver`) over an immutable snapshot. Two tiny additive helpers are exported from `formula` (`IsIdentifier`, `IsReservedName`).

**Tech Stack:** Go (module `github.com/gccurtis/taurus-omega`), no new dependencies.

## Global Constraints

- **One-directional dependency:** `names` imports `formula`; `formula` must NOT import `names`. The only formula surface `names` uses: the `Value` model + constructors, `Kind` constants, `Parse`, `NodeFunction`, `TableValue`, `Service.Evaluate`/`Service.EvaluateWith`, `Resolver`, and the two helpers added in Task 1.
- **Deterministic given its store.** This increment adds NO clock and NO timestamps (deferred to Increment 4, the wiring/API layer). Evaluation snapshots entries once so it is deterministic.
- **Reuse the evaluator unchanged.** Do not modify evaluator semantics or the `Value` model beyond the two additive exported helpers in Task 1. Existing formula tests must keep passing.
- **No function serialization.** A stored value may never contain a function in a cell (rejected on write). A function entry stores only its source text.
- **Reserved / valid names.** An entry (and a table column) name must be a legal identifier and must not collide with a builtin or keyword.
- **Companion docs:** every non-test `*.go` created or touched keeps a byte-verbatim `FILE.go.md` sibling, updated in the same commit; verify with the extract-and-diff check (concatenated ```go blocks reproduce the source exactly, tabs preserved).
- **Change record:** this increment is `docs/records/0022-formula-name-manager.md` (next free number after `0021`).
- Each task ends green: `go build ./...`, `go vet ./...`, `go test ./...`.

---

### Task 1: Export `IsIdentifier` and `IsReservedName` from `formula`

**Files:**
- Modify: `core/capability/formula/syntax.go` (+ `syntax.go.md`)
- Modify: `core/capability/formula/functions.go` (+ `functions.go.md`)
- Test: `core/capability/formula/syntax_test.go`

**Interfaces:**
- Produces: `func IsIdentifier(s string) bool`; `func IsReservedName(s string) bool`.

- [ ] **Step 1: Write the failing test**

Add to `core/capability/formula/syntax_test.go`:

```go
func TestExportedNameHelpers(t *testing.T) {
	for _, ok := range []string{"price", "_x", "a1", "totalScore"} {
		if !formula.IsIdentifier(ok) {
			t.Errorf("IsIdentifier(%q) = false; want true", ok)
		}
	}
	for _, bad := range []string{"", "1a", "a b", "a-b", "has space"} {
		if formula.IsIdentifier(bad) {
			t.Errorf("IsIdentifier(%q) = true; want false", bad)
		}
	}
	for _, reserved := range []string{"SUM", "sum", "If", "TABLE", "FUNCTION", "lambda", "true", "false", "null"} {
		if !formula.IsReservedName(reserved) {
			t.Errorf("IsReservedName(%q) = false; want true", reserved)
		}
	}
	for _, free := range []string{"price", "total", "people", "myFunc"} {
		if formula.IsReservedName(free) {
			t.Errorf("IsReservedName(%q) = true; want false", free)
		}
	}
}
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `go test ./core/capability/formula/ -run TestExportedNameHelpers`
Expected: FAIL — `IsIdentifier` / `IsReservedName` undefined.

- [ ] **Step 3: Add the helpers**

In `syntax.go`, after `validFieldName`:

```go
// IsIdentifier reports whether s is a legal Formula identifier — the same rule
// as a field name (a letter or underscore, then letters, digits, or
// underscores). Name-manager entry and column names must satisfy it so they are
// referenceable from an expression.
func IsIdentifier(s string) bool {
	return validFieldName(s)
}
```

In `functions.go`, after `isBuiltinCall`:

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

- [ ] **Step 4: Update companions, run tests**

Update `syntax.go.md` and `functions.go.md` to match (byte-verbatim). Run: `go test ./core/capability/formula/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add core/capability/formula/syntax.go core/capability/formula/syntax.go.md \
        core/capability/formula/functions.go core/capability/formula/functions.go.md \
        core/capability/formula/syntax_test.go
git commit -m "feat(formula): export IsIdentifier and IsReservedName"
```

---

### Task 2: The `names` package foundation — types, store, Manager

**Files:**
- Create: `core/capability/formula/names/names.go` (+ `names.go.md`)
- Create: `core/capability/formula/names/memory.go` (+ `memory.go.md`)
- Test: `core/capability/formula/names/memory_test.go`

**Interfaces:**
- Produces: `EntryType`, `ColumnType`, `Column`, `Entry`; the sentinel errors; `NameStore` interface; `Manager` + `New`; `MemoryStore` + `NewMemoryStore`.

- [ ] **Step 1: Write the failing test**

Create `core/capability/formula/names/memory_test.go`:

```go
package names_test

import (
	"errors"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/formula"
	"github.com/gccurtis/taurus-omega/core/capability/formula/names"
)

func TestMemoryStoreRoundTrip(t *testing.T) {
	store := names.NewMemoryStore()
	price, _ := formula.NumberValue("42")
	entry := names.Entry{Name: "price", Type: names.TypeNumber, Value: price}

	if err := store.PutName("p1", entry); err != nil {
		t.Fatalf("PutName: %v", err)
	}
	got, err := store.Name("p1", "price")
	if err != nil || got.Name != "price" || got.Type != names.TypeNumber {
		t.Fatalf("Name = %+v, %v; want the stored entry", got, err)
	}
	// Project isolation.
	if _, err := store.Name("p2", "price"); !errors.Is(err, names.ErrNotFound) {
		t.Errorf("Name in other project = %v; want ErrNotFound", err)
	}
	list, err := store.Names("p1")
	if err != nil || len(list) != 1 {
		t.Fatalf("Names = %v, %v; want one entry", list, err)
	}
	if err := store.DeleteName("p1", "price"); err != nil {
		t.Fatalf("DeleteName: %v", err)
	}
	if _, err := store.Name("p1", "price"); !errors.Is(err, names.ErrNotFound) {
		t.Errorf("after delete = %v; want ErrNotFound", err)
	}
	if err := store.DeleteName("p1", "price"); !errors.Is(err, names.ErrNotFound) {
		t.Errorf("delete absent = %v; want ErrNotFound", err)
	}
}
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `go test ./core/capability/formula/names/`
Expected: FAIL — package does not exist yet.

- [ ] **Step 3: Create `names.go`**

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
	Name string
	Type ColumnType
}

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
)

// NameStore persists name-manager entries, keyed by (project, name).
type NameStore interface {
	PutName(project string, entry Entry) error
	Name(project, name string) (Entry, error) // ErrNotFound if absent
	Names(project string) ([]Entry, error)
	DeleteName(project, name string) error // ErrNotFound if absent
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
```

- [ ] **Step 4: Create `memory.go`**

```go
package names

import "sync"

// MemoryStore is an in-memory NameStore, safe for concurrent use. It backs tests
// and the package until a durable store is wired.
type MemoryStore struct {
	mu       sync.Mutex
	projects map[string]map[string]Entry // project -> name -> entry
}

// NewMemoryStore returns an empty in-memory store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{projects: make(map[string]map[string]Entry)}
}

func (s *MemoryStore) PutName(project string, entry Entry) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	names, ok := s.projects[project]
	if !ok {
		names = make(map[string]Entry)
		s.projects[project] = names
	}
	names[entry.Name] = entry
	return nil
}

func (s *MemoryStore) Name(project, name string) (Entry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	entry, ok := s.projects[project][name]
	if !ok {
		return Entry{}, ErrNotFound
	}
	return entry, nil
}

func (s *MemoryStore) Names(project string) ([]Entry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []Entry
	for _, entry := range s.projects[project] {
		out = append(out, entry)
	}
	return out, nil
}

func (s *MemoryStore) DeleteName(project, name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.projects[project][name]; !ok {
		return ErrNotFound
	}
	delete(s.projects[project], name)
	return nil
}
```

- [ ] **Step 5: Create companions, run tests**

Create `names.go.md` and `memory.go.md` (byte-verbatim; mirror the structure of an existing companion such as `core/capability/access/memory.go.md`). Verify each with the extract-and-diff check. Run: `go test ./core/capability/formula/names/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add core/capability/formula/names/
git commit -m "feat(names): name manager types, store port, and in-memory store"
```

---

### Task 3: Setters, validation, and accessors

**Files:**
- Create: `core/capability/formula/names/manager.go` (+ `manager.go.md`)
- Test: `core/capability/formula/names/manager_test.go`

**Interfaces:**
- Consumes: `Entry`/`Column`/errors/`NameStore`/`Manager` (Task 2), `formula.IsIdentifier`/`IsReservedName` (Task 1).
- Produces: `Manager.SetScalar`, `Manager.SetTable`, `Manager.SetFunction`, `Manager.Get`, `Manager.List`, `Manager.Delete`, and the unexported validation helpers.

- [ ] **Step 1: Write the failing test**

Create `core/capability/formula/names/manager_test.go`:

```go
package names_test

import (
	"errors"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/formula"
	"github.com/gccurtis/taurus-omega/core/capability/formula/names"
)

func newManager() *names.Manager {
	return names.New(names.NewMemoryStore(), formula.NewService())
}

func num(t *testing.T, s string) formula.Value {
	t.Helper()
	v, err := formula.NumberValue(s)
	if err != nil {
		t.Fatalf("NumberValue(%q): %v", s, err)
	}
	return v
}

func text(t *testing.T, s string) formula.Value {
	t.Helper()
	v, err := formula.TextValue(s)
	if err != nil {
		t.Fatalf("TextValue(%q): %v", s, err)
	}
	return v
}

func TestSettersAndValidation(t *testing.T) {
	m := newManager()

	// Scalars.
	if err := m.SetScalar("p", "price", num(t, "42")); err != nil {
		t.Fatalf("SetScalar: %v", err)
	}
	if _, err := m.Get("p", "price"); err != nil {
		t.Fatalf("Get: %v", err)
	}

	// Reserved and invalid names.
	if err := m.SetScalar("p", "SUM", num(t, "1")); !errors.Is(err, names.ErrReservedName) {
		t.Errorf("SetScalar reserved = %v; want ErrReservedName", err)
	}
	if err := m.SetScalar("p", "has space", num(t, "1")); !errors.Is(err, names.ErrInvalidName) {
		t.Errorf("SetScalar invalid = %v; want ErrInvalidName", err)
	}

	// A structured value is not a scalar.
	list := formula.ListValue([]formula.Value{num(t, "1")})
	if err := m.SetScalar("p", "xs", list); !errors.Is(err, names.ErrNotScalar) {
		t.Errorf("SetScalar(list) = %v; want ErrNotScalar", err)
	}

	// Tables: schema + type enforcement.
	cols := []names.Column{{Name: "name", Type: names.ColumnText}, {Name: "score", Type: names.ColumnNumber}}
	rows := [][]formula.Value{{text(t, "Ada"), num(t, "88")}, {text(t, "Bea"), num(t, "70")}}
	if err := m.SetTable("p", "people", cols, rows); err != nil {
		t.Fatalf("SetTable: %v", err)
	}
	// Wrong cell type.
	bad := [][]formula.Value{{text(t, "Cy"), text(t, "high")}}
	if err := m.SetTable("p", "bad", cols, bad); !errors.Is(err, names.ErrTypeMismatch) {
		t.Errorf("SetTable type mismatch = %v; want ErrTypeMismatch", err)
	}
	// Null is always allowed.
	nullRow := [][]formula.Value{{formula.NullValue(), formula.NullValue()}}
	if err := m.SetTable("p", "nulls", cols, nullRow); err != nil {
		t.Errorf("SetTable(null cells) = %v; want ok", err)
	}
	// Ragged row.
	if err := m.SetTable("p", "ragged", cols, [][]formula.Value{{text(t, "Ada")}}); !errors.Is(err, names.ErrRaggedRow) {
		t.Errorf("SetTable ragged = %v; want ErrRaggedRow", err)
	}
	// Duplicate column.
	dup := []names.Column{{Name: "a", Type: names.ColumnNumber}, {Name: "a", Type: names.ColumnNumber}}
	if err := m.SetTable("p", "dup", dup, nil); !errors.Is(err, names.ErrDuplicateColumn) {
		t.Errorf("SetTable dup column = %v; want ErrDuplicateColumn", err)
	}

	// Functions: must be a FUNCTION/LAMBDA definition.
	if err := m.SetFunction("p", "double", "FUNCTION(n, n * 2)"); err != nil {
		t.Fatalf("SetFunction: %v", err)
	}
	if err := m.SetFunction("p", "notfn", "1 + 2"); !errors.Is(err, names.ErrNotAFunction) {
		t.Errorf("SetFunction(non-function) = %v; want ErrNotAFunction", err)
	}
	if err := m.SetFunction("p", "brokn", "FUNCTION(n,"); err == nil {
		t.Errorf("SetFunction(unparsable) = nil; want a parse error")
	}

	// A function may not be stored inside a table cell.
	fn, _ := formula.Evaluate("FUNCTION(x, x)", nil)
	fnCol := []names.Column{{Name: "f", Type: names.ColumnTable}}
	nested := formula.ListValue([]formula.Value{fn})
	if err := m.SetTable("p", "withfn", fnCol, [][]formula.Value{{nested}}); !errors.Is(err, names.ErrFunctionInCell) {
		t.Errorf("SetTable(function in cell) = %v; want ErrFunctionInCell", err)
	}

	// List / Delete.
	all, err := m.List("p")
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(all) == 0 {
		t.Errorf("List empty; want the stored entries")
	}
	if err := m.Delete("p", "price"); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := m.Get("p", "price"); !errors.Is(err, names.ErrNotFound) {
		t.Errorf("Get after delete = %v; want ErrNotFound", err)
	}
}
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `go test ./core/capability/formula/names/ -run TestSettersAndValidation`
Expected: FAIL — setters undefined.

- [ ] **Step 3: Implement `manager.go`**

```go
package names

import "github.com/gccurtis/taurus-omega/core/capability/formula"

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
```

- [ ] **Step 4: Update companion, run tests**

Create `manager.go.md` (byte-verbatim). Verify with extract-and-diff. Run: `go test ./core/capability/formula/names/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add core/capability/formula/names/manager.go core/capability/formula/names/manager.go.md \
        core/capability/formula/names/manager_test.go
git commit -m "feat(names): setters with schema/type enforcement and accessors"
```

---

### Task 4: Reconstruction, resolver, and evaluation

**Files:**
- Create: `core/capability/formula/names/resolver.go` (+ `resolver.go.md`)
- Test: `core/capability/formula/names/resolver_test.go`

**Interfaces:**
- Consumes: `Entry`/`Manager` (Task 2–3), `formula.Resolver`/`TableValue`/`Service.Evaluate`/`Service.EvaluateWith` (formula).
- Produces: `Manager.Evaluate(project, source string) (formula.Value, error)`; unexported `namespaceResolver` (implements `formula.Resolver`) and `reconstruct`.

- [ ] **Step 1: Write the failing test**

Create `core/capability/formula/names/resolver_test.go`:

```go
package names_test

import (
	"errors"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/formula"
	"github.com/gccurtis/taurus-omega/core/capability/formula/names"
)

func TestEvaluateAgainstNamespace(t *testing.T) {
	m := newManager()
	p := "proj"

	// Scalar.
	if err := m.SetScalar(p, "price", num(t, "42")); err != nil {
		t.Fatal(err)
	}
	if got := eval(t, m, p, "price + 1"); got != "43" {
		t.Errorf("price + 1 = %s; want 43", got)
	}

	// Table: reconstructs as a table value, so a column reads as a list.
	cols := []names.Column{{Name: "name", Type: names.ColumnText}, {Name: "score", Type: names.ColumnNumber}}
	rows := [][]formula.Value{{text(t, "Ada"), num(t, "88")}, {text(t, "Bea"), num(t, "70")}}
	if err := m.SetTable(p, "people", cols, rows); err != nil {
		t.Fatal(err)
	}
	if got := eval(t, m, p, "SUM(people.score)"); got != "158" {
		t.Errorf("SUM(people.score) = %s; want 158", got)
	}

	// Function referencing another name — resolved late, against the namespace.
	if err := m.SetScalar(p, "factor", num(t, "10")); err != nil {
		t.Fatal(err)
	}
	if err := m.SetFunction(p, "scale", "FUNCTION(n, n * factor)"); err != nil {
		t.Fatal(err)
	}
	if got := eval(t, m, p, "scale(4)"); got != "40" {
		t.Errorf("scale(4) = %s; want 40", got)
	}

	// Mutual reference between two stored functions.
	if err := m.SetFunction(p, "twice", "FUNCTION(n, scale(scale(n)))"); err != nil {
		t.Fatal(err)
	}
	if got := eval(t, m, p, "twice(3)"); got != "300" {
		t.Errorf("twice(3) = %s; want 300", got)
	}

	// Unknown identifier.
	_, err := m.Evaluate(p, "missing + 1")
	var fe *formula.FormulaError
	if !errors.As(err, &fe) || fe.Kind != formula.ErrorUnknownIdentifier {
		t.Errorf("Evaluate(missing) = %#v; want unknown_identifier", err)
	}

	// Namespace isolation: another project does not see these names.
	if _, err := m.Evaluate("other", "price + 1"); !errors.As(err, &fe) || fe.Kind != formula.ErrorUnknownIdentifier {
		t.Errorf("cross-project Evaluate = %#v; want unknown_identifier", err)
	}
}

func eval(t *testing.T, m *names.Manager, project, source string) string {
	t.Helper()
	v, err := m.Evaluate(project, source)
	if err != nil {
		t.Fatalf("Evaluate(%q): %v", source, err)
	}
	return v.String()
}
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `go test ./core/capability/formula/names/ -run TestEvaluateAgainstNamespace`
Expected: FAIL — `Manager.Evaluate` undefined.

- [ ] **Step 3: Implement `resolver.go`**

```go
package names

import "github.com/gccurtis/taurus-omega/core/capability/formula"

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

- [ ] **Step 4: Update companion, run tests**

Create `resolver.go.md` (byte-verbatim). Verify with extract-and-diff. Run:

```bash
go test ./core/capability/formula/names/
go build ./... && go vet ./... && go test ./...
```

Expected: PASS across the module.

- [ ] **Step 5: Commit**

```bash
git add core/capability/formula/names/resolver.go core/capability/formula/names/resolver.go.md \
        core/capability/formula/names/resolver_test.go
git commit -m "feat(names): reconstruct entries and evaluate against the namespace"
```

---

### Task 5: Docs, change record, and companion verification

**Files:**
- Create: `docs/architecture/capabilities/formula/name-manager.md`
- Modify: `docs/architecture/capabilities/formula/README.md` (link the new page)
- Create: `docs/records/0022-formula-name-manager.md`

**Interfaces:**
- Consumes: the shipped `names` package behaviour from Tasks 1–4.

- [ ] **Step 1: Write the architecture page**

Create `docs/architecture/capabilities/formula/name-manager.md`: the one-directional `names → formula` relationship and the `Resolver` seam; the entry type model (scalar stores its value, function stores source, table stores schema + rows; list/record are tables); reconstruction into a `Value`; the reserved-name / identifier rule; type enforcement on `SetTable` (and that a function may never be a cell); and `Evaluate` snapshotting the namespace. State clearly that this package is **library-only, unwired** in this increment (no HTTP, no persistence yet) and that timestamps and the SQLite store come with the wiring increment. Ground every claim in `core/capability/formula/names/*.go`. Link it from the formula `README.md`.

- [ ] **Step 2: Write the change record**

Create `docs/records/0022-formula-name-manager.md` — one `##` per file (`formula/syntax.go` + `functions.go` for the exported helpers; `names/names.go`, `names/memory.go`, `names/manager.go`, `names/resolver.go`), each with `###` what/goal/why entries. State explicitly: `names → formula` one-directional dependency; deterministic (no clock/timestamps this increment); reuses the `Resolver` port unchanged; functions stored as source and never permitted in a cell.

- [ ] **Step 3: Verify companions and links**

```bash
for f in syntax functions; do
  awk '/^```go$/{x=1;next}/^```$/{x=0}x' "core/capability/formula/$f.go.md" | diff - "core/capability/formula/$f.go" >/dev/null && echo "OK $f" || echo "DRIFT $f"
done
for f in names memory manager resolver; do
  awk '/^```go$/{x=1;next}/^```$/{x=0}x' "core/capability/formula/names/$f.go.md" | diff - "core/capability/formula/names/$f.go" >/dev/null && echo "OK $f" || echo "DRIFT $f"
done
```

Expected: `OK` for every file. Confirm the new markdown links resolve.

- [ ] **Step 4: Final build/vet/test**

```bash
go build ./... && go vet ./... && go test ./...
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/architecture/capabilities/formula/name-manager.md \
        docs/architecture/capabilities/formula/README.md \
        docs/records/0022-formula-name-manager.md
git commit -m "docs(names): document the name manager and record the change"
```

---

## Self-Review

**Spec coverage (Part 2 of the design):**
- `formula/names` package, `names → formula` one-directional dependency — Tasks 2–4. ✅
- `Manager`, `NameStore` port, `memory.go` — Task 2. ✅
- Type model: scalar stores value / function stores source / table stores schema+rows; list & record are tables — Tasks 2–4. ✅
- `SetScalar` / `SetTable` / `SetFunction` / `Get` / `List` / `Delete` with type enforcement — Task 3. ✅
- Reserved-name + identifier rule (`IsReservedName`/`IsIdentifier`) — Tasks 1, 3. ✅
- Function-in-cell rejection — Task 3. ✅
- `Resolver` implementation + `Evaluate`-against-namespace, deterministic snapshot, late binding for functions — Task 4. ✅
- Docs + record + companions — Task 5. ✅

**Deferred (by design, to later increments):** constructive `CreateTable`/`AddColumn`/`AppendRows` (Increment 3); SQLite store, transport, handlers, wiring, timestamps, and the orientation "wired" flip (Increment 4).

**Type consistency:** `Entry` fields (`Value`/`Schema`/`Rows`/`Source`) are populated by the Task-3 setters exactly as read by Task-4 `reconstruct`. `NameStore`'s four methods are implemented identically by `MemoryStore` (Task 2) and called by the Manager (Tasks 3–4). `namespaceResolver` satisfies `formula.Resolver` (`Resolve(string) (Value, bool, error)`).

**Risk notes:**
- A function value is reconstructed by re-evaluating its source per `Resolve`; correct because a definition resolves no free names, and free names bind later against the applying evaluator's resolver (this namespace). Cross-function and mutual references are covered by `TestEvaluateAgainstNamespace` and bounded by the evaluator's step/depth ceilings.
- A stored table reconstructs as a `KindTable` value (a stored "list"/"record" is a one-field/one-row table), matching the design's decision; column reads therefore yield lists, consistent with `SUM(people.score)`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-21-formula-name-manager-core.md`. This is **Increment 2 of 4**; Increment 3 (constructive typed tables) and Increment 4 (SQLite + transport + wiring) follow, each planned after the prior lands.
