package names_test

import (
	"errors"
	"sync"
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

func TestGetReturnsIsolatedCopy(t *testing.T) {
	m := newManager()
	p := "p"
	cols := []names.Column{{Name: "name", Type: names.ColumnText}, {Name: "score", Type: names.ColumnNumber}}
	rows := [][]formula.Value{{text(t, "Ada"), num(t, "88")}}
	if err := m.SetTable(p, "people", cols, rows); err != nil {
		t.Fatal(err)
	}
	// Mutate a value read back from the store.
	got, err := m.Get(p, "people")
	if err != nil {
		t.Fatal(err)
	}
	got.Rows[0][0] = text(t, "TAMPERED")
	got.Schema[0].Name = "tampered"

	// The store must be unaffected.
	again, err := m.Get(p, "people")
	if err != nil {
		t.Fatal(err)
	}
	if v, _ := again.Rows[0][0].Text(); v != "Ada" {
		t.Errorf("stored cell = %q; want Ada (store was corrupted by a caller mutation)", v)
	}
	if again.Schema[0].Name != "name" {
		t.Errorf("stored column = %q; want name", again.Schema[0].Name)
	}
	// Evaluation still sees the original data.
	sum, err := m.Evaluate(p, "SUM(people.score)")
	if err != nil {
		t.Fatal(err)
	}
	if sum.String() != "88" {
		t.Errorf("SUM(people.score) = %s; want 88", sum.String())
	}
}

func TestConstructiveTableBuilding(t *testing.T) {
	m := newManager()
	p := "p"
	cols := []names.Column{{Name: "name", Type: names.ColumnText}, {Name: "score", Type: names.ColumnNumber}}

	if err := m.CreateTable(p, "people", cols); err != nil {
		t.Fatalf("CreateTable: %v", err)
	}
	// Creating over an existing name fails rather than clobbering.
	if err := m.CreateTable(p, "people", cols); !errors.Is(err, names.ErrNameExists) {
		t.Errorf("CreateTable(existing) = %v; want ErrNameExists", err)
	}
	// A fresh table is empty.
	if got := eval(t, m, p, "ROWS(people)"); got != "0" {
		t.Errorf("ROWS(people) = %s; want 0", got)
	}
	if got := eval(t, m, p, "COLUMNS(people)"); got != "2" {
		t.Errorf("COLUMNS(people) = %s; want 2", got)
	}

	// Append rows, type-checked against the schema.
	rows := [][]formula.Value{{text(t, "Ada"), num(t, "88")}, {text(t, "Bea"), num(t, "70")}}
	if err := m.AppendRows(p, "people", rows); err != nil {
		t.Fatalf("AppendRows: %v", err)
	}
	if got := eval(t, m, p, "SUM(people.score)"); got != "158" {
		t.Errorf("SUM(people.score) = %s; want 158", got)
	}
	bad := [][]formula.Value{{text(t, "Cy"), text(t, "nope")}}
	if err := m.AppendRows(p, "people", bad); !errors.Is(err, names.ErrTypeMismatch) {
		t.Errorf("AppendRows(bad type) = %v; want ErrTypeMismatch", err)
	}

	// Add a column; existing rows gain a null cell.
	if err := m.AddColumn(p, "people", names.Column{Name: "active", Type: names.ColumnLogic}); err != nil {
		t.Fatalf("AddColumn: %v", err)
	}
	if got := eval(t, m, p, "COLUMNS(people)"); got != "3" {
		t.Errorf("COLUMNS(people) after AddColumn = %s; want 3", got)
	}
	if got := eval(t, m, p, "ROWS(people)"); got != "2" {
		t.Errorf("ROWS(people) after AddColumn = %s; want 2", got)
	}
	// A duplicate column is rejected.
	if err := m.AddColumn(p, "people", names.Column{Name: "name", Type: names.ColumnText}); !errors.Is(err, names.ErrDuplicateColumn) {
		t.Errorf("AddColumn(dup) = %v; want ErrDuplicateColumn", err)
	}
	// New rows must match the widened schema.
	if err := m.AppendRows(p, "people", [][]formula.Value{{text(t, "Cy"), num(t, "90"), formula.LogicValue(true)}}); err != nil {
		t.Fatalf("AppendRows(widened): %v", err)
	}
	if got := eval(t, m, p, "SUM(people.score)"); got != "248" {
		t.Errorf("SUM(people.score) = %s; want 248", got)
	}

	// AddColumn/AppendRows on a non-table or a missing name fail cleanly.
	if err := m.SetScalar(p, "x", num(t, "1")); err != nil {
		t.Fatal(err)
	}
	if err := m.AddColumn(p, "x", names.Column{Name: "c", Type: names.ColumnNumber}); !errors.Is(err, names.ErrNotATable) {
		t.Errorf("AddColumn(scalar) = %v; want ErrNotATable", err)
	}
	if err := m.AppendRows(p, "x", nil); !errors.Is(err, names.ErrNotATable) {
		t.Errorf("AppendRows(scalar) = %v; want ErrNotATable", err)
	}
	if err := m.AddColumn(p, "missing", names.Column{Name: "c", Type: names.ColumnNumber}); !errors.Is(err, names.ErrNotFound) {
		t.Errorf("AddColumn(missing) = %v; want ErrNotFound", err)
	}
}

func TestAppendRowsConcurrentNoLostUpdate(t *testing.T) {
	m := newManager()
	p := "p"
	if err := m.CreateTable(p, "t", []names.Column{{Name: "n", Type: names.ColumnNumber}}); err != nil {
		t.Fatal(err)
	}
	one := num(t, "1") // formula.Value is immutable, so it is safe to share across goroutines.

	const workers = 25
	var wg sync.WaitGroup
	errs := make([]error, workers)
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			errs[i] = m.AppendRows(p, "t", [][]formula.Value{{one}})
		}(i)
	}
	wg.Wait()

	for i, err := range errs {
		if err != nil {
			t.Fatalf("worker %d: %v", i, err)
		}
	}
	// Every concurrent append must survive: the store's read-modify-write is
	// atomic, so no update is lost.
	if got := eval(t, m, p, "ROWS(t)"); got != "25" {
		t.Errorf("ROWS(t) = %s; want 25 (a lost update dropped a row)", got)
	}
}
