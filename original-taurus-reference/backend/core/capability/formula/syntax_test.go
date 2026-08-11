package formula_test

import (
	"encoding/json"
	"errors"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/formula"
)

func TestExpressionJSONRoundTripRemainsEvaluable(t *testing.T) {
	expression, err := formula.Parse(`people.{score >= cutoff, active = true}.{name}!`)
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(expression)
	if err != nil {
		t.Fatal(err)
	}
	var decoded formula.Expression
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatal(err)
	}
	people := evaluate(t, `TABLE({name: "Ada", score: 92, active: true})`, nil)
	value, err := formula.NewService().EvaluateExpression(&decoded, formula.Bindings{
		"people": people,
		"cutoff": number(t, "88"),
	})
	if err != nil {
		t.Fatal(err)
	}
	if got := value.String(); got != `{name: "Ada"}` {
		t.Fatalf("decoded expression = %s; want projected record", got)
	}
}

func TestParseLiteralsCollectionsAndPostfixQueries(t *testing.T) {
	tests := []struct {
		source string
		type_  formula.NodeType
	}{
		{"12.5", formula.NodeLiteral},
		{`"hello"`, formula.NodeLiteral},
		{"true", formula.NodeLiteral},
		{"null", formula.NodeLiteral},
		{"[1, 2, 3]", formula.NodeList},
		{`{name: "Ada", score: 9}`, formula.NodeRecord},
		{"people.name", formula.NodeField},
		{"people[1]", formula.NodeIndex},
		{"people[-1]", formula.NodeIndex},
		{"people[1:3]", formula.NodeSlice},
		{"people[:3]", formula.NodeSlice},
		{"people[2:]", formula.NodeSlice},
		{"people[:]", formula.NodeSlice},
		{"people.{name, score}", formula.NodeProjection},
		{"people.{score >= 88}", formula.NodeQuery},
		{`people.{status = "active", score != 0}`, formula.NodeQuery},
		{"people.{score >= 88 || vip = true}", formula.NodeQuery},
		{"people.{(score > 0 || vip = true) && active = true}", formula.NodeQuery},
		{"people.{!(archived = true)}", formula.NodeQuery},
		{`people.{id = 1}!`, formula.NodePromote},
		{`people.{id = 1}?`, formula.NodeOptional},
	}
	for _, test := range tests {
		expression, err := formula.Parse(test.source)
		if err != nil {
			t.Errorf("Parse(%q): %v", test.source, err)
			continue
		}
		if expression.LanguageVersion != formula.LanguageVersion || expression.Root.Type != test.type_ {
			t.Errorf("Parse(%q) = version %q, root %q; want %q, %q", test.source, expression.LanguageVersion, expression.Root.Type, formula.LanguageVersion, test.type_)
		}
	}
}

func TestParsePostfixSelectionsCarryStaticFieldsAndConditions(t *testing.T) {
	expression, err := formula.Parse(`people.{score >= cutoff, active = true}.{name, id}`)
	if err != nil {
		t.Fatal(err)
	}
	projection := expression.Root
	if projection.Type != formula.NodeProjection || len(projection.Projection) != 2 || projection.Projection[0].Name != "name" || projection.Projection[1].Name != "id" {
		t.Fatalf("projection AST = %+v", projection)
	}
	query := projection.Target
	if query.Type != formula.NodeQuery || query.Predicate == nil {
		t.Fatalf("query AST = %+v", query)
	}
	// A comma builds a top-level AND of two comparison leaves.
	root := query.Predicate
	if root.Type != formula.NodePredAnd {
		t.Fatalf("predicate root = %+v; want pred_and", root)
	}
	if root.Left.Type != formula.NodePredCompare || root.Left.Name != "score" || root.Left.Operator != ">=" || root.Left.Right.Type != formula.NodeName {
		t.Fatalf("left leaf = %+v", root.Left)
	}
	if root.Right.Type != formula.NodePredCompare || root.Right.Name != "active" || root.Right.Operator != "=" {
		t.Fatalf("right leaf = %+v", root.Right)
	}
}

func TestParseArithmeticPrecedenceAndAssociativity(t *testing.T) {
	expression, err := formula.Parse("1 + 2 * 3 ^ 2 - 4")
	if err != nil {
		t.Fatal(err)
	}
	root := expression.Root
	if root.Type != formula.NodeBinary || root.Operator != "-" || root.Left.Operator != "+" || root.Left.Right.Operator != "*" || root.Left.Right.Right.Operator != "^" {
		t.Fatalf("unexpected tree: %+v", root)
	}

	expression, err = formula.Parse("2 ^ 3 ^ 2")
	if err != nil {
		t.Fatal(err)
	}
	if expression.Root.Operator != "^" || expression.Root.Right.Operator != "^" {
		t.Fatalf("power is not right associative: %+v", expression.Root)
	}

	expression, err = formula.Parse("-2 ^ 2")
	if err != nil {
		t.Fatal(err)
	}
	if expression.Root.Type != formula.NodeUnary || expression.Root.Right.Operator != "^" {
		t.Fatalf("unary minus should apply after power: %+v", expression.Root)
	}
}

func TestParseReportsStableSpansAndLimits(t *testing.T) {
	_, err := formula.Parse("1 +")
	var formulaErr *formula.FormulaError
	if !errors.As(err, &formulaErr) || formulaErr.Kind != formula.ErrorParse || formulaErr.Span != (formula.Span{Start: 3, End: 3}) {
		t.Fatalf("parse error = %#v; want parse_error at [3:3]", err)
	}

	service := formula.New(formula.Options{Limits: formula.Limits{MaxTokens: 3}})
	_, err = service.Parse("1 + 2 + 3")
	if !errors.As(err, &formulaErr) || formulaErr.Kind != formula.ErrorLimitExceeded || formulaErr.Limit != "tokens" {
		t.Fatalf("token limit error = %#v", err)
	}

	service = formula.New(formula.Options{Limits: formula.Limits{MaxDepth: 1}})
	_, err = service.Parse("1 + 2")
	if !errors.As(err, &formulaErr) || formulaErr.Kind != formula.ErrorLimitExceeded || formulaErr.Limit != "parse_depth" {
		t.Fatalf("AST depth error = %#v", err)
	}
}

func TestParseFunctionAndApply(t *testing.T) {
	for _, src := range []string{
		"FUNCTION(x, x * 2)",
		"LAMBDA(n, n * n)",
		"FUNCTION(42)",
		"FUNCTION(a, b, a + b)(1, 2)",
		"double(21)",
		"(FUNCTION(x, x))(5)",
	} {
		if _, err := formula.Parse(src); err != nil {
			t.Errorf("Parse(%q) = %v; want ok", src, err)
		}
	}
	for _, bad := range []string{
		"FUNCTION()",          // no body
		"FUNCTION(1, x)",      // non-identifier parameter
		"FUNCTION(x, x, x*2)", // duplicate parameter is fine only if names differ; this is a dup
	} {
		if _, err := formula.Parse(bad); err == nil {
			t.Errorf("Parse(%q) = nil; want parse error", bad)
		}
	}
}

func TestParseRejectsMalformedCollectionsAndSlices(t *testing.T) {
	for _, source := range []string{
		`.5`,
		`{x: 1, x: 2}`,
		`[1, 2`,
		`people[]`,
		`people[1:2:3]`,
		`people.`,
		`people.{}`,
		`people.{name,}`,
		`people.{name, name}`,
		`people.{score =}`,
		`people.{score = 1,}`,
		`people.{name, score = 1}`,
		`people.{score == 1}`,
		`"unterminated`,
		`"\xff"`,
	} {
		if _, err := formula.Parse(source); err == nil {
			t.Errorf("Parse(%q) unexpectedly succeeded", source)
		}
	}
}

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
