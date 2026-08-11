package formula_test

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/formula"
)

func number(t *testing.T, source string) formula.Value {
	t.Helper()
	value, err := formula.NumberValue(source)
	if err != nil {
		t.Fatal(err)
	}
	return value
}

func text(t *testing.T, source string) formula.Value {
	t.Helper()
	value, err := formula.TextValue(source)
	if err != nil {
		t.Fatal(err)
	}
	return value
}

func TestExactNumbersAndCanonicalFormatting(t *testing.T) {
	tests := map[string]string{
		"1.2500": "1.25",
		"1e3":    "1000",
		"-0":     "0",
		"0.125":  "0.125",
	}
	for source, want := range tests {
		got, ok := number(t, source).NumberString()
		if !ok || got != want {
			t.Errorf("NumberValue(%q) = %q, %v; want %q, true", source, got, ok, want)
		}
	}
}

func TestStructuredValuesShareTableShapes(t *testing.T) {
	list := formula.ListValue([]formula.Value{number(t, "1"), number(t, "2")})
	if got, want := list.Shape(), (formula.Shape{Fields: 1, Rows: 2}); got != want {
		t.Errorf("list shape = %+v; want %+v", got, want)
	}

	record, err := formula.RecordValue(
		[]string{"name", "score"},
		[]formula.Value{text(t, "Ada"), number(t, "9")},
	)
	if err != nil {
		t.Fatal(err)
	}
	if got, want := record.Shape(), (formula.Shape{Fields: 2, Rows: 1}); got != want {
		t.Errorf("record shape = %+v; want %+v", got, want)
	}

	table, err := formula.TableValue([]string{"name", "score"}, [][]formula.Value{
		{text(t, "Ada"), number(t, "9")},
		{text(t, "Bea"), number(t, "8")},
	})
	if err != nil {
		t.Fatal(err)
	}
	if got, want := table.Shape(), (formula.Shape{Fields: 2, Rows: 2}); got != want {
		t.Errorf("table shape = %+v; want %+v", got, want)
	}
	column, ok := table.Field("score")
	if !ok || column.Kind() != formula.KindList || column.String() != "[9, 8]" {
		t.Errorf("score column = %s, %v", column.String(), ok)
	}
}

func TestTableValidationAndCopies(t *testing.T) {
	if _, err := formula.NewTable([]string{"x", "x"}, nil); err == nil {
		t.Error("duplicate fields accepted")
	}
	if _, err := formula.NewTable([]string{"x", "y"}, [][]formula.Value{{number(t, "1")}}); err == nil {
		t.Error("short row accepted")
	}

	fields := []string{"x"}
	rows := [][]formula.Value{{number(t, "1")}}
	table, err := formula.NewTable(fields, rows)
	if err != nil {
		t.Fatal(err)
	}
	fields[0] = "changed"
	rows[0][0] = number(t, "2")
	gotRows := table.Rows()
	gotRows[0][0] = number(t, "3")
	if table.Fields()[0] != "x" || table.Rows()[0][0].String() != "1" {
		t.Errorf("table aliases caller-owned slices: fields=%v rows=%v", table.Fields(), table.Rows())
	}
}

func TestValueJSONRoundTripPreservesExactTypedData(t *testing.T) {
	record, err := formula.RecordValue(
		[]string{"ratio", "active", "tags"},
		[]formula.Value{
			number(t, "1/3"),
			formula.LogicValue(true),
			formula.ListValue([]formula.Value{text(t, "a"), formula.NullValue()}),
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(record)
	if err != nil {
		t.Fatal(err)
	}
	var decoded formula.Value
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatal(err)
	}
	if !decoded.Equal(record) {
		t.Fatalf("round trip changed value:\n%s\n%s", record.String(), decoded.String())
	}
}

func TestValueJSONRejectsMissingOrFalseShapeAndTrailingData(t *testing.T) {
	for _, encoded := range []string{
		`{"kind":"number","number":"1"}`,
		`{"kind":"number","shape":{"fields":2,"rows":1},"number":"1"}`,
		`{"kind":"record","shape":{"fields":1,"rows":1},"fields":["x"],"rows":[]}`,
		`{"kind":"null","shape":{"fields":1,"rows":1},"number":"1"}`,
		`{"kind":"null","shape":{"fields":1,"rows":1}} {}`,
	} {
		var value formula.Value
		if err := json.Unmarshal([]byte(encoded), &value); err == nil {
			t.Errorf("json.Unmarshal(%s) unexpectedly succeeded", encoded)
		}
	}
}

func TestValueConstructorsRejectInvalidUTF8(t *testing.T) {
	invalid := string([]byte{0xff})
	if _, err := formula.TextValue(invalid); err == nil {
		t.Error("TextValue accepted invalid UTF-8")
	}
	if _, err := formula.NewTable([]string{invalid}, nil); err == nil {
		t.Error("NewTable accepted an invalid UTF-8 field")
	}
}

func TestFunctionValueKindAndShape(t *testing.T) {
	// A function value is produced only by evaluation; construct one via Evaluate.
	v, err := formula.Evaluate("FUNCTION(x, x * 2)", nil)
	if err != nil {
		t.Fatalf("Evaluate: %v", err)
	}
	if v.Kind() != formula.KindFunction {
		t.Fatalf("Kind = %s; want function", v.Kind())
	}
	if shape := v.Shape(); shape.Fields != 1 || shape.Rows != 1 {
		t.Errorf("Shape = %+v; want 1x1", shape)
	}
	if got := v.String(); got != "FUNCTION(x, x * 2)" {
		t.Errorf("String = %q; want the source text", got)
	}
}

func TestFunctionValueMarshalsDisplayOnly(t *testing.T) {
	v, err := formula.Evaluate("FUNCTION(a, b, a + b)", nil)
	if err != nil {
		t.Fatalf("Evaluate: %v", err)
	}
	data, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}
	got := string(data)
	if !strings.Contains(got, `"kind":"function"`) || !strings.Contains(got, `"params":["a","b"]`) {
		t.Errorf("marshal = %s; want function descriptor with params", got)
	}
	var back formula.Value
	if err := json.Unmarshal(data, &back); err == nil {
		t.Errorf("Unmarshal of a function must fail; got nil error")
	}
}

func TestNumberPreflightAndLargeTerminatingFormat(t *testing.T) {
	if _, err := formula.NumberValue("1e100000000"); err == nil {
		t.Error("NumberValue accepted a number beyond the default bit bound")
	}
	zero, err := formula.NumberValue("0e100000000")
	if err != nil || zero.String() != "0" {
		t.Fatalf("large zero exponent = %v, %v", zero, err)
	}
	value, err := formula.NumberValue("1e-30000")
	if err != nil {
		t.Fatal(err)
	}
	formatted, ok := value.NumberString()
	if !ok || len(formatted) != 30002 || formatted[:3] != "0.0" || formatted[len(formatted)-1:] != "1" {
		t.Fatalf("large terminating decimal was not formatted canonically: ok=%v len=%d", ok, len(formatted))
	}
}
