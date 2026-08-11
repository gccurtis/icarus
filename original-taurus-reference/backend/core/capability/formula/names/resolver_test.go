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
