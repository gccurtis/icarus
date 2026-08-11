package formula_test

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/formula"
)

func evaluate(t *testing.T, source string, bindings formula.Bindings) formula.Value {
	t.Helper()
	value, err := formula.Evaluate(source, bindings)
	if err != nil {
		t.Fatalf("Evaluate(%q): %v", source, err)
	}
	return value
}

func TestEvaluateExactArithmeticAndParentheses(t *testing.T) {
	tests := map[string]string{
		"1.":            "1",
		"1 + 2 * 3":     "7",
		"(1 + 2) * 3":   "9",
		"0.1 + 0.2":     "0.3",
		"1 / 3":         "1/3",
		"-2 ^ 2":        "-4",
		"2 ^ 3 ^ 2":     "512",
		"17 % 5":        "2",
		"2 ^ -3":        "0.125",
		"+4 - -2":       "6",
		"10 / 4 + 0.25": "2.75",
	}
	for source, want := range tests {
		if got := evaluate(t, source, nil).String(); got != want {
			t.Errorf("%s = %s; want %s", source, got, want)
		}
	}
}

func TestEvaluateBindingsCollectionsFieldsAndIndexes(t *testing.T) {
	people := evaluate(t, `TABLE(
		{name: "Ada", score: 92},
		{name: "Bea", score: 84},
		{name: "Cy", score: 88}
	)`, nil)
	bindings := formula.Bindings{"people": people, "position": number(t, "2")}
	tests := map[string]string{
		"people[1].name":          `"Ada"`,
		"people[-1].name":         `"Cy"`,
		"people.score":            "[92, 84, 88]",
		"people[position].name":   `"Bea"`, // index by a binding — no parens needed
		"people[(position)].name": `"Bea"`, // parentheses are now plain grouping
		"people.score[2]":         "84",
		"people[1:3].name":        `["Ada", "Bea"]`,
		"people[-2:].name":        `["Bea", "Cy"]`,
		"people[:-1].name":        `["Ada", "Bea"]`,
		"people[:].name":          `["Ada", "Bea", "Cy"]`,
		"[10, 20, 30][-2]":        "20",
		"[10, 20, 30][2:]":        "[20, 30]",
		"[10, 20, 30][-99:99]":    "[10, 20, 30]",
		"[10, 20, 30][3:1]":       "[]",
		`{name: "Ada"}.name`:      `"Ada"`,
	}
	for source, want := range tests {
		if got := evaluate(t, source, bindings).String(); got != want {
			t.Errorf("%s = %s; want %s", source, got, want)
		}
	}
}

func TestEvaluateArithmeticFunctions(t *testing.T) {
	tests := map[string]string{
		"SUM([1, 2, 3])":        "6",
		"PRODUCT([2, 3, 4])":    "24",
		"MIN(3, -1, 2)":         "-1",
		"MAX([3, -1, 2])":       "3",
		"AVG([1, 2, 4])":        "7/3",
		"AVERAGE(1, 2, 3)":      "2",
		"COUNT([1, null, 3])":   "2",
		"ABS(-3.5)":             "3.5",
		"MOD(17, 5)":            "2",
		"POWER(2, -3)":          "0.125",
		"Pow(2, 3)":             "8",
		"ROUND(2.5)":            "3",
		"ROUND(-2.5)":           "-3",
		"ROUND(12.345, 2)":      "12.35",
		"ROUND(125, -1)":        "130",
		"FLOOR(-1.2)":           "-2",
		"CEIL(-1.2)":            "-1",
		"ceiling(1.2)":          "2",
		"SUM()":                 "0",
		"sum(1, 2)":             "3",
		"PRODUCT()":             "1",
		"ROWS([[1], [2], [3]])": "3",
		"COLUMNS({a: 1, b: 2})": "2",
		"ROWS(TRUE)":            "1",
	}
	for source, want := range tests {
		if got := evaluate(t, source, nil).String(); got != want {
			t.Errorf("%s = %s; want %s", source, got, want)
		}
	}
}

func TestEvaluateTableConstructionProjectionAndFiltering(t *testing.T) {
	people := evaluate(t, `TABLE([
		{id: 1, name: "Ada", score: 92},
		{name: "Bea", score: 84, id: 2},
		{id: 3, name: "Cy", score: 88}
	])`, nil)
	bindings := formula.Bindings{"people": people}
	if got := evaluate(t, "people[2]", bindings).String(); got != `{id: 2, name: "Bea", score: 84}` {
		t.Fatalf("TABLE did not reorder the second record into the first row's schema: %s", got)
	}

	filtered := evaluate(t, `people.{score >= 88}`, bindings)
	if got, want := filtered.String(), `TABLE({id: 1, name: "Ada", score: 92}, {id: 3, name: "Cy", score: 88})`; got != want {
		t.Errorf("filtered = %s; want %s", got, want)
	}
	projected := evaluate(t, `filtered.{name, score}`, formula.Bindings{"filtered": filtered})
	if got, want := projected.String(), `TABLE({name: "Ada", score: 92}, {name: "Cy", score: 88})`; got != want {
		t.Errorf("projected = %s; want %s", got, want)
	}
	if got := evaluate(t, `SUM(people.{score >= 88}.score)`, bindings).String(); got != "180" {
		t.Errorf("query aggregate = %s; want 180", got)
	}
	selectedRecord := evaluate(t, `people[1].{name}`, bindings)
	if got := selectedRecord.String(); got != `{name: "Ada"}` {
		t.Errorf("record projection = %s", got)
	}
	empty := evaluate(t, `people.{score > 100}`, bindings)
	if got, want := empty.Shape(), (formula.Shape{Fields: 3, Rows: 0}); got != want {
		t.Errorf("empty filter lost its schema: got %+v, want %+v", got, want)
	}
	if got := evaluate(t, "empty.name", formula.Bindings{"empty": empty}).String(); got != "[]" {
		t.Errorf("empty table column = %s; want []", got)
	}
}

func TestEvaluatePostfixQueryConditionsAndPromotion(t *testing.T) {
	people := evaluate(t, `TABLE(
		{id: 1, name: "Ada", score: 92, active: true, note: null},
		{id: 2, name: "Bea", score: 84, active: false, note: "away"},
		{id: 3, name: "Cy", score: 88, active: true, note: null}
	)`, nil)
	bindings := formula.Bindings{"people": people, "cutoff": number(t, "88")}
	tests := map[string]string{
		`people.{id = 2}`:                                  `TABLE({id: 2, name: "Bea", score: 84, active: false, note: "away"})`,
		`people.{id != 2}.{name}`:                          `TABLE({name: "Ada"}, {name: "Cy"})`,
		`people.{score < cutoff}.name`:                     `["Bea"]`,
		`people.{score <= cutoff}.name`:                    `["Bea", "Cy"]`,
		`people.{score > cutoff}.name`:                     `["Ada"]`,
		`people.{score >= cutoff, active = true}.name`:     `["Ada", "Cy"]`,
		`people.{note = null}.name`:                        `["Ada", "Cy"]`,
		`people[1:3].{active = true}.{name, score}`:        `TABLE({name: "Ada", score: 92})`,
		`people.{id = 2}!.name`:                            `"Bea"`,
		`people.{id = 2}?.name`:                            `"Bea"`,
		`people.{id = 99}?`:                                `null`,
		`people[1]!`:                                       `{id: 1, name: "Ada", score: 92, active: true, note: null}`,
		`{id: 1, name: "Ada"}.{id = 1}`:                    `TABLE({id: 1, name: "Ada"})`,
		`{id: 1, name: "Ada"}.{id = 2}`:                    `TABLE()`,
		`TABLE({displayName: "Ada", id: 1}).{displayName}`: `TABLE({displayName: "Ada"})`,
	}
	for source, want := range tests {
		if got := evaluate(t, source, bindings).String(); got != want {
			t.Errorf("%s = %s; want %s", source, got, want)
		}
	}
}

func TestBooleanQueryPredicates(t *testing.T) {
	people := evaluate(t, `TABLE(
		{name: "Ada", score: 92, vip: true},
		{name: "Bea", score: 84, vip: false},
		{name: "Cy", score: 5, vip: false}
	)`, nil)
	bindings := formula.Bindings{"people": people, "cutoff": number(t, "88")}
	tests := map[string]string{
		`people.{score >= 88 || score < 10}.name`:                  `["Ada", "Cy"]`, // OR
		`people.{score > 80 && vip = false}.name`:                  `["Bea"]`,       // AND
		`people.{!(vip = true)}.name`:                              `["Bea", "Cy"]`, // NOT
		`people.{(score >= 50) ^ (vip = true)}.name`:               `["Bea"]`,       // XOR
		`people.{vip = true, score >= 88}.name`:                    `["Ada"]`,       // comma = AND
		`people.{score >= 50 || vip = true, name = "Bea"}.name`:    `["Bea"]`,       // comma is looser than ||
		`people.{score >= 88 && vip = false || score < 10}.name`:   `["Cy"]`,        // && binds tighter than ||
		`people.{score >= 88 && (vip = false || score < 10)}.name`: `[]`,            // parentheses override precedence
		`people.{score >= cutoff}.name`:                            `["Ada"]`,       // RHS is a binding, evaluated once
	}
	for source, want := range tests {
		if got := evaluate(t, source, bindings).String(); got != want {
			t.Errorf("%s = %s; want %s", source, got, want)
		}
	}
	// XOR operands must be parenthesized: a bare `^` inside a comparison RHS is the
	// power operator, so `score >= 50 ^ vip = true` does not parse as XOR.
	if _, err := formula.Evaluate(`people.{score >= 50 ^ vip = true}`, bindings); err == nil {
		t.Errorf("unparenthesized XOR operands: got nil error; want a parse error")
	}
}

func TestQueryFieldToFieldResolution(t *testing.T) {
	projects := evaluate(t, `TABLE(
		{name: "A", budget: 100, spent: 120},
		{name: "B", budget: 100, spent: 80},
		{name: "C", budget: 50,  spent: 50}
	)`, nil)
	bindings := formula.Bindings{"projects": projects, "budget": number(t, "1000")}
	tests := map[string]string{
		// Field-to-field: both names are columns, compared per row.
		`projects.{spent > budget}.name`:       `["A"]`,
		`projects.{spent = budget}.name`:       `["C"]`,
		`projects.{spent > budget * 0.5}.name`: `["A", "B", "C"]`, // RHS arithmetic over a field
		// A name that is a column beats a like-named binding (field-first). The
		// `budget` binding (1000) is shadowed by the budget column here.
		`projects.{budget >= 100}.name`: `["A", "B"]`,
	}
	for source, want := range tests {
		if got := evaluate(t, source, bindings).String(); got != want {
			t.Errorf("%s = %s; want %s", source, got, want)
		}
	}
	// A name that is neither a column nor a binding is unknown_identifier.
	if _, err := formula.Evaluate(`projects.{spent > missing}`, bindings); err == nil {
		t.Errorf("unknown name in query: got nil error; want unknown_identifier")
	}
}

func TestSelectionFunctionsAreNotFormulaSurface(t *testing.T) {
	for _, source := range []string{
		`SELECT(TABLE({x: 1}), "x")`,
		`WHERE(TABLE({x: 1}), "x", "=", 1)`,
	} {
		_, err := formula.Evaluate(source, nil)
		var formulaErr *formula.FormulaError
		if !errors.As(err, &formulaErr) || formulaErr.Kind != formula.ErrorUnknownFunction {
			t.Errorf("Evaluate(%q) error = %#v; want unknown_function", source, err)
		}
	}
}

func TestAggregatesSkipNull(t *testing.T) {
	// Numeric aggregates ignore null cells, matching COUNT and spreadsheet
	// convention, rather than raising a type error on the first null.
	values := map[string]string{
		"SUM([1, null, 3])":        "4",
		"PRODUCT([2, null, 3])":    "6",
		"MIN([3, null, 1, 2])":     "1",
		"MAX([3, null, 1, 2])":     "3",
		"AVG([1, null, 3])":        "2",
		"COUNT([1, null, 3])":      "2",
		"SUM([null])":              "0",
		"SUM(TABLE({x: 1}).{x=2})": "0", // aggregate over an empty (null-free) table
	}
	for source, want := range values {
		if got := evaluate(t, source, nil).String(); got != want {
			t.Errorf("%s = %s; want %s", source, got, want)
		}
	}
	// A collection with no numbers at all still fails for MIN/MAX/AVG, which
	// require at least one number to aggregate.
	for _, source := range []string{"MIN([null])", "MAX([null])", "AVG([null])"} {
		if _, err := formula.Evaluate(source, nil); err == nil {
			t.Errorf("Evaluate(%q) = nil error; want an error (no numbers)", source)
		}
	}
	// Non-null, non-number members are still a type error.
	if _, err := formula.Evaluate(`SUM([1, "x"])`, nil); err == nil {
		t.Errorf(`SUM([1, "x"]) = nil error; want type_error`)
	}
}

func TestEvaluateStableErrorsAndLimits(t *testing.T) {
	tests := []struct {
		source string
		kind   formula.ErrorKind
	}{
		{"missing + 1", formula.ErrorUnknownIdentifier},
		{"NOPE(1)", formula.ErrorUnknownFunction},
		{`1 + "x"`, formula.ErrorType},
		{"1 / 0", formula.ErrorDivideByZero},
		{"1.5 % 1", formula.ErrorType},
		{"[1][0]", formula.ErrorInvalidIndex},
		{"[1][2]", formula.ErrorIndexOutOfRange},
		{`TABLE({x: 1})["x"]`, formula.ErrorInvalidIndex}, // brackets are positional only
		{`{x: 1}["x"]`, formula.ErrorInvalidIndex},        // records don't support indexing
		{`{"has space": 1}`, formula.ErrorParse},          // field names must be identifiers
		{`{x: 1}.missing`, formula.ErrorUnknownField},
		{`TABLE({x: 1}, {y: 2})`, formula.ErrorInvalidTable},
		{`TABLE({x: "a"}).{x > "b"}`, formula.ErrorType},
		// In a query an identifier is a field first, then a binding; a name that is
		// neither is unknown_identifier (not unknown_field).
		{`TABLE({x: 1}).{missing = 1}`, formula.ErrorUnknownIdentifier},
		{`TABLE({x: 1}, {x: 2})!`, formula.ErrorCardinality},
		{`TABLE()!`, formula.ErrorCardinality},
		{`TABLE({x: 1}, {x: 2})?`, formula.ErrorCardinality},
		{`[1].{value = 1}`, formula.ErrorType},
	}
	for _, test := range tests {
		_, err := formula.Evaluate(test.source, nil)
		var formulaErr *formula.FormulaError
		if !errors.As(err, &formulaErr) || formulaErr.Kind != test.kind {
			t.Errorf("Evaluate(%q) error = %#v; want %s", test.source, err, test.kind)
		}
	}
	precedence := []struct {
		source string
		kind   formula.ErrorKind
	}{
		{"NOPE(1 / 0)", formula.ErrorUnknownFunction},
		{"ABS(1, 1 / 0)", formula.ErrorWrongArity},
		{"MIN()", formula.ErrorWrongArity},
		{`SELECT(TABLE({x: 1}), [])`, formula.ErrorUnknownFunction},
	}
	for _, test := range precedence {
		_, err := formula.Evaluate(test.source, nil)
		var formulaErr *formula.FormulaError
		if !errors.As(err, &formulaErr) || formulaErr.Kind != test.kind {
			t.Errorf("Evaluate(%q) error = %#v; want %s", test.source, err, test.kind)
		}
	}

	service := formula.New(formula.Options{Limits: formula.Limits{MaxSteps: 4}})
	_, err := service.Evaluate("1 + 2 + 3", nil)
	var formulaErr *formula.FormulaError
	if !errors.As(err, &formulaErr) || formulaErr.Kind != formula.ErrorLimitExceeded || formulaErr.Limit != "evaluation_steps" {
		t.Fatalf("step limit error = %#v", err)
	}
}

func TestEvaluateRejectsUnknownLanguageVersion(t *testing.T) {
	expression, err := formula.Parse("1 + 2")
	if err != nil {
		t.Fatal(err)
	}
	expression.LanguageVersion = "formula/v999"
	_, err = formula.NewService().EvaluateExpression(expression, nil)
	var formulaErr *formula.FormulaError
	if !errors.As(err, &formulaErr) || formulaErr.Kind != formula.ErrorUnsupportedVersion {
		t.Fatalf("version error = %#v", err)
	}
}

func TestEveryDeterministicLimitHasAStableFailure(t *testing.T) {
	tests := []struct {
		name   string
		limits formula.Limits
		source string
		limit  string
	}{
		{"source", formula.Limits{MaxSourceBytes: 3}, "1 + 2", "source_bytes"},
		{"nodes", formula.Limits{MaxNodes: 2}, "1 + 2", "ast_nodes"},
		{"parse depth", formula.Limits{MaxDepth: 2}, "[[[1]]]", "parse_depth"},
		{"rows", formula.Limits{MaxRows: 2}, "[1, 2, 3]", "rows"},
		{"fields", formula.Limits{MaxFields: 1}, "{a: 1, b: 2}", "fields"},
		{"cells", formula.Limits{MaxCells: 3}, "TABLE({a: 1, b: 2}, {a: 3, b: 4})", "cells"},
		{"output", formula.Limits{MaxOutputBytes: 3}, `"four"`, "output_bytes"},
		{"number bits", formula.Limits{MaxNumberBits: 64}, "2 ^ 100", "number_bits"},
		{"power", formula.Limits{MaxPower: 2}, "2 ^ 3", "power"},
		{"round", formula.Limits{MaxRoundPlaces: 2}, "ROUND(1.234, 3)", "round_places"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := formula.New(formula.Options{Limits: test.limits}).Evaluate(test.source, nil)
			var formulaErr *formula.FormulaError
			if !errors.As(err, &formulaErr) || formulaErr.Kind != formula.ErrorLimitExceeded || formulaErr.Limit != test.limit {
				t.Fatalf("error = %#v; want limit_exceeded/%s", err, test.limit)
			}
		})
	}
}

func TestConfiguredLimitsCanOnlyTightenHardCeilings(t *testing.T) {
	defaults := formula.DefaultLimits()
	effective := formula.New(formula.Options{Limits: formula.Limits{
		MaxSourceBytes: defaults.MaxSourceBytes + 1,
		MaxTokens:      defaults.MaxTokens + 1,
		MaxNodes:       defaults.MaxNodes + 1,
		MaxDepth:       defaults.MaxDepth + 1,
		MaxSteps:       defaults.MaxSteps + 1,
		MaxFields:      defaults.MaxFields + 1,
		MaxRows:        defaults.MaxRows + 1,
		MaxCells:       defaults.MaxCells + 1,
		MaxOutputBytes: defaults.MaxOutputBytes + 1,
		MaxNumberBits:  defaults.MaxNumberBits + 1,
		MaxPower:       defaults.MaxPower + 1,
		MaxRoundPlaces: defaults.MaxRoundPlaces + 1,
	}}).Limits()
	if effective != defaults {
		t.Fatalf("limits above hard ceilings = %+v; want %+v", effective, defaults)
	}
}

func TestLimitsCoverDiscardedIntermediatesAndGrowth(t *testing.T) {
	tests := []struct {
		name   string
		limits formula.Limits
		source string
		limit  string
	}{
		{"discarded text", formula.Limits{MaxOutputBytes: 3}, `ROWS(["four"])`, "output_bytes"},
		{"discarded cells", formula.Limits{MaxCells: 3}, "ROWS([1, 2, 3, 4])", "cells"},
		{"nested power", formula.Limits{}, "((10 ^ 1024) ^ 1024) ^ 1024", "number_bits"},
		{"terminating decimal output", formula.Limits{MaxOutputBytes: 100}, "1 / (2 ^ 200)", "output_bytes"},
		{"literal preflight", formula.Limits{}, "1e100000000", "number_bits"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := formula.New(formula.Options{Limits: test.limits}).Evaluate(test.source, nil)
			var formulaErr *formula.FormulaError
			if !errors.As(err, &formulaErr) || formulaErr.Kind != formula.ErrorLimitExceeded || formulaErr.Limit != test.limit {
				t.Fatalf("error = %#v; want limit_exceeded/%s", err, test.limit)
			}
		})
	}
}

func TestEvaluateExpressionRevalidatesPublicAST(t *testing.T) {
	literal := func() *formula.Node {
		value := number(t, "1")
		return &formula.Node{Type: formula.NodeLiteral, Value: &value}
	}
	expression := &formula.Expression{
		LanguageVersion: formula.LanguageVersion,
		Root: &formula.Node{
			Type: formula.NodeCall,
			Name: "SUM",
			Args: []*formula.Node{literal(), literal(), literal()},
		},
	}
	_, err := formula.New(formula.Options{Limits: formula.Limits{MaxNodes: 3}}).EvaluateExpression(expression, nil)
	var formulaErr *formula.FormulaError
	if !errors.As(err, &formulaErr) || formulaErr.Kind != formula.ErrorLimitExceeded || formulaErr.Limit != "ast_nodes" {
		t.Fatalf("forged AST error = %#v; want limit_exceeded/ast_nodes", err)
	}

	cycle := &formula.Node{Type: formula.NodeGroup}
	cycle.Left = cycle
	expression = &formula.Expression{LanguageVersion: formula.LanguageVersion, Root: cycle}
	_, err = formula.New(formula.Options{Limits: formula.Limits{MaxNodes: 3}}).EvaluateExpression(expression, nil)
	if !errors.As(err, &formulaErr) || formulaErr.Kind != formula.ErrorLimitExceeded || formulaErr.Limit != "ast_nodes" {
		t.Fatalf("cyclic AST error = %#v; want limit_exceeded/ast_nodes", err)
	}

	expression = &formula.Expression{
		LanguageVersion: formula.LanguageVersion,
		Root: &formula.Node{
			Type:   formula.NodeQuery,
			Target: literal(),
			Predicate: &formula.Node{
				Type:     formula.NodePredCompare,
				Name:     "x",
				Operator: "contains",
				Right:    literal(),
			},
		},
	}
	_, err = formula.NewService().EvaluateExpression(expression, nil)
	if !errors.As(err, &formulaErr) || formulaErr.Kind != formula.ErrorParse {
		t.Fatalf("forged query error = %#v; want parse_error", err)
	}
}

func TestZeroWidthBindingStillConsumesRowWork(t *testing.T) {
	rows := make([][]formula.Value, 100)
	table, err := formula.TableValue(nil, rows)
	if err != nil {
		t.Fatal(err)
	}
	_, err = formula.New(formula.Options{Limits: formula.Limits{MaxSteps: 50}}).Evaluate("t", formula.Bindings{"t": table})
	var formulaErr *formula.FormulaError
	if !errors.As(err, &formulaErr) || formulaErr.Kind != formula.ErrorLimitExceeded || formulaErr.Limit != "evaluation_steps" {
		t.Fatalf("zero-width table error = %#v; want limit_exceeded/evaluation_steps", err)
	}
}

type upperResolver struct{}

func (upperResolver) Resolve(name string) (formula.Value, bool, error) {
	if name == "answer" {
		v, _ := formula.NumberValue("42")
		return v, true, nil
	}
	return formula.Value{}, false, nil
}

func TestEvaluateWithResolver(t *testing.T) {
	v, err := formula.NewService().EvaluateWith("answer + 1", upperResolver{})
	if err != nil {
		t.Fatalf("EvaluateWith: %v", err)
	}
	if got := v.String(); got != "43" {
		t.Errorf("answer + 1 = %s; want 43", got)
	}
}

func TestEvaluateFunctions(t *testing.T) {
	cases := map[string]string{
		"FUNCTION(x, x * 2)(21)":                      "42",
		"FUNCTION(a, b, a + b)(2, 3)":                 "5",
		"(FUNCTION(n, n * n))(5)":                     "25",
		"FUNCTION(f, x, f(x))(FUNCTION(n, n * n), 6)": "36",
		"FUNCTION(x, x)(FUNCTION(y, y + 1))(9)":       "10", // returns a function, then applies it
	}
	for src, want := range cases {
		v, err := formula.Evaluate(src, nil)
		if err != nil {
			t.Fatalf("Evaluate(%q): %v", src, err)
		}
		if got := v.String(); got != want {
			t.Errorf("%s = %s; want %s", src, got, want)
		}
	}

	// A registered function resolves free names against the namespace late.
	dbl, _ := formula.Evaluate("FUNCTION(n, n * factor)", nil) // captures nothing; factor is free
	_ = dbl
	factor, _ := formula.NumberValue("10")
	fnExpr := "scale(4)"
	res, err := formula.NewService().EvaluateWith(fnExpr, mapResolver{
		"scale":  mustFn(t, "FUNCTION(n, n * factor)"),
		"factor": factor,
	})
	if err != nil {
		t.Fatalf("EvaluateWith(%q): %v", fnExpr, err)
	}
	if got := res.String(); got != "40" {
		t.Errorf("scale(4) = %s; want 40", got)
	}

	// Errors.
	for _, bad := range []struct {
		src  string
		kind formula.ErrorKind
	}{
		{"FUNCTION(x, x)(1, 2)", formula.ErrorWrongArity},
		{"5(3)", formula.ErrorType},
		{"NOPE(1)", formula.ErrorUnknownFunction},
		{"NOPE(1 / 0)", formula.ErrorUnknownFunction},
	} {
		_, err := formula.Evaluate(bad.src, nil)
		var fe *formula.FormulaError
		if !errors.As(err, &fe) || fe.Kind != bad.kind {
			t.Errorf("Evaluate(%q) error = %#v; want %s", bad.src, err, bad.kind)
		}
	}
}

func TestNestedClosureSourceAcrossEvaluations(t *testing.T) {
	adder := mustFn(t, "FUNCTION(x, FUNCTION(y, x + y))")
	svc := formula.NewService()

	// Applied result is correct across evaluations.
	full, err := svc.EvaluateWith("adder(3)(4)", mapResolver{"adder": adder})
	if err != nil || full.String() != "7" {
		t.Fatalf("adder(3)(4) = %v, %v; want 7", full, err)
	}

	// The partially-applied inner closure keeps its correct source (not "" or garbage),
	// even though it is produced under a different evaluation source than where it was defined.
	partial, err := svc.EvaluateWith("adder(3)", mapResolver{"adder": adder})
	if err != nil {
		t.Fatalf("adder(3): %v", err)
	}
	if got := partial.String(); got != "FUNCTION(y, x + y)" {
		t.Errorf("partial.String() = %q; want the inner function source", got)
	}
	data, err := json.Marshal(partial)
	if err != nil {
		t.Fatalf("Marshal(partial): %v", err)
	}
	if !strings.Contains(string(data), `"source":"FUNCTION(y, x + y)"`) {
		t.Errorf("marshal = %s; want the inner source in the descriptor", data)
	}
}

type mapResolver map[string]formula.Value

func (m mapResolver) Resolve(name string) (formula.Value, bool, error) {
	v, ok := m[name]
	return v, ok, nil
}

func mustFn(t *testing.T, src string) formula.Value {
	t.Helper()
	v, err := formula.Evaluate(src, nil)
	if err != nil {
		t.Fatalf("mustFn(%q): %v", src, err)
	}
	return v
}

func TestFunctionSafetyAndEdges(t *testing.T) {
	// Recursion terminates against the step/depth ceilings rather than hanging.
	rec := "f(1)"
	_, err := formula.NewService().EvaluateWith(rec, mapResolver{
		"f": mustFn(t, "FUNCTION(n, f(n))"),
	})
	var fe *formula.FormulaError
	if !errors.As(err, &fe) || fe.Kind != formula.ErrorLimitExceeded {
		t.Errorf("unbounded recursion error = %#v; want limit_exceeded", err)
	}

	// Zero-parameter function.
	if v, err := formula.Evaluate("FUNCTION(7)()", nil); err != nil || v.String() != "7" {
		t.Errorf("FUNCTION(7)() = %v, %v; want 7", v, err)
	}

	// Applying a non-function.
	if _, err := formula.Evaluate("(1 + 1)(3)", nil); err == nil {
		t.Error("applying a number must error")
	}

	// A free identifier that is neither a parameter nor resolvable.
	if _, err := formula.Evaluate("FUNCTION(x, x + missing)(1)", nil); err == nil {
		t.Error("unknown free identifier must error")
	}

	// Existing unknown-function contract is intact.
	for _, src := range []string{"NOPE(1)", "SELECT(TABLE({x: 1}), [])"} {
		_, err := formula.Evaluate(src, nil)
		if !errors.As(err, &fe) || fe.Kind != formula.ErrorUnknownFunction {
			t.Errorf("Evaluate(%q) = %#v; want unknown_function", src, err)
		}
	}
}

func TestOutputBoundIncludesTableSchema(t *testing.T) {
	table, err := formula.TableValue([]string{strings.Repeat("field", 30)}, nil)
	if err != nil {
		t.Fatal(err)
	}
	_, err = formula.New(formula.Options{Limits: formula.Limits{MaxOutputBytes: 100}}).Evaluate("t", formula.Bindings{"t": table})
	var formulaErr *formula.FormulaError
	if !errors.As(err, &formulaErr) || formulaErr.Kind != formula.ErrorLimitExceeded || formulaErr.Limit != "output_bytes" {
		t.Fatalf("large schema error = %#v; want limit_exceeded/output_bytes", err)
	}
}
