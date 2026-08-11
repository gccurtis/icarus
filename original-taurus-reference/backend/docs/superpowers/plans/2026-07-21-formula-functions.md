# Formula `FUNCTION` / `LAMBDA` Implementation Plan (Increment 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class user-defined functions (`FUNCTION` / `LAMBDA`) to the pure formula evaluator, plus the `Resolver` port the name manager will later plug into — all additive, so existing behaviour and tests stand.

**Architecture:** A new scalar value type `KindFunction` carries parameter names, a parsed body, its exact source text, and a lexical closure. `FUNCTION(p…, body)` parses to a new `NodeFunction`; a postfix `(` parses to a new `NodeApply`; `name(args)` stays a `NodeCall` whose evaluator now applies a bound function when the name is not a builtin. Identifier resolution moves behind a `Resolver` interface that `Bindings` satisfies, so the current API is unchanged.

**Tech Stack:** Go (module `github.com/gccurtis/taurus-omega`), pure-Go, no new dependencies. Package `core/capability/formula`.

## Global Constraints

- The pure evaluator stays **deterministic and side-effect-free**: no storage, clock, randomness, network, model, or cross-capability work.
- **Every change is additive.** Existing value kinds, evaluator semantics, AST shapes for existing syntax, and all current tests must keep passing unchanged. In particular `NOPE(1)` and `NOPE(1 / 0)` stay `unknown_function` (evaluated before args), and `SELECT(...)` stays `unknown_function`.
- **Function values are never serialized.** `MarshalJSON` emits a display-only descriptor; `UnmarshalJSON` rejects `kind: function`.
- **DoS bounds are preserved.** Every application charges one step (`MaxSteps`) and deepens `depth` (`MaxDepth`); `FUNCTION`/apply are ordinary AST nodes bounded by `validateExpression`.
- **Companion docs:** every non-test `*.go` touched or created keeps a byte-verbatim `FILE.go.md` sibling, updated in the **same commit**. Verify with the repo's extract-and-diff check (concatenated ```go blocks reproduce the source exactly, tabs preserved).
- **Change record:** this increment is `docs/records/0021-formula-functions.md` (next free number after `0020`), one `##` per file, `###` per change with what/goal/why.
- Each task ends green: `go build ./...`, `go vet ./...`, `go test ./...`.

---

### Task 1: `KindFunction` value type

**Files:**
- Modify: `core/capability/formula/value.go`
- Create: `core/capability/formula/function.go`
- Create: `core/capability/formula/function.go.md`
- Test: `core/capability/formula/value_test.go`

**Interfaces:**
- Produces: `KindFunction Kind = "function"`; unexported `functionValue struct { params []string; body *Node; source string }`; `Value` gains an unexported field `fn *functionValue`. The lexical-closure field `captured *scope` is added in Task 5 once the `scope` type exists, so Task 1 compiles on its own. The two Task-1 tests (`TestFunctionValueKindAndShape`, and Task 2's marshal test) only pass once Tasks 4–5 land (nothing evaluates `FUNCTION` yet) — keep them red until then, or gate this series so Tasks 1–5 land together before running the package tests.

- [ ] **Step 1: Write the failing test**

Add to `core/capability/formula/value_test.go`:

```go
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
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `go test ./core/capability/formula/ -run TestFunctionValueKindAndShape`
Expected: FAIL — `KindFunction` undefined / `FUNCTION` currently `unknown_function`. (It cannot pass until Tasks 4–5 land; keep it and make it green there. For an independently-green Task 1, temporarily assert only compile-level facts — see Step 4.)

- [ ] **Step 3: Add the kind and payload**

In `core/capability/formula/value.go`, add to the `Kind` constant block:

```go
	KindFunction Kind = "function"
```

Add the field to `Value`:

```go
type Value struct {
	kind   Kind
	number *big.Rat
	text   string
	logic  bool
	table  *Table
	fn     *functionValue
}
```

Create `core/capability/formula/function.go`:

```go
package formula

// functionValue is the immutable payload of a KindFunction value: the ordered
// parameter names, the parsed body, and the exact source text used for display
// and equality. The lexical closure captured at definition is added in
// evaluate.go (the captured field) once the scope type exists.
type functionValue struct {
	params   []string
	body     *Node
	source   string
	captured *scope
}

// functionShapeFields / functionShapeRows describe a function's scalar shape.
const (
	functionShapeFields = 1
	functionShapeRows   = 1
)
```

In `value.go`, extend the switches that must account for the new kind:

`Equal` — add before `default`:

```go
	case KindFunction:
		if v.fn == nil || other.fn == nil {
			return false
		}
		if len(v.fn.params) != len(other.fn.params) {
			return false
		}
		for i := range v.fn.params {
			if v.fn.params[i] != other.fn.params[i] {
				return false
			}
		}
		return v.fn.source == other.fn.source
```

`String` — add before `default`:

```go
	case KindFunction:
		if v.fn == nil {
			return "<function>"
		}
		return v.fn.source
```

`MarshalJSON` — extend `wireValue` with two fields and add a case. Add to the struct:

```go
		Params []string  `json:"params,omitempty"`
		Source *string   `json:"source,omitempty"`
```

and the case (before `case KindNull:`):

```go
	case KindFunction:
		if v.fn == nil {
			return nil, fmt.Errorf("formula: function value has no payload")
		}
		out.Params = append([]string(nil), v.fn.params...)
		source := v.fn.source
		out.Source = &source
```

`UnmarshalJSON` — reject early. In the `switch kind {` that builds `allowed`, add:

```go
	case KindFunction:
		return fmt.Errorf("formula: function values cannot be decoded")
```

`Shape` needs no change (function values have `table == nil`, so `Shape` already returns `{1, 1}`). `clone` needs no change (its `default` returns the value with the `fn` pointer copied; functions are immutable).

- [ ] **Step 4: Create the companion and make the package compile**

Create `core/capability/formula/function.go.md` whose concatenated ```go blocks reproduce `function.go` byte-for-byte. Because `functionValue.captured *scope` references a type not yet defined, land Task 5's `scope` stub in the same working series; to keep Task 1 compiling on its own, omit the `captured` field here and add it in Task 5.

Run: `go build ./core/capability/formula/`
Expected: compiles.

- [ ] **Step 5: Commit**

```bash
git add core/capability/formula/value.go core/capability/formula/function.go core/capability/formula/function.go.md core/capability/formula/value_test.go
git commit -m "feat(formula): add KindFunction value type and payload"
```

---

### Task 2: Function value in `inspectValue` (output bounding)

**Files:**
- Modify: `core/capability/formula/evaluate.go`
- Modify: `core/capability/formula/evaluate.go.md`
- Test: `core/capability/formula/value_test.go`

**Interfaces:**
- Consumes: `KindFunction`, `functionValue.source` (Task 1).
- Produces: `inspectValue` returns a bounded size for a function so `admitValue` accepts it.

- [ ] **Step 1: Write the failing test**

```go
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
```

(Add `"encoding/json"` to the test file imports if absent.)

- [ ] **Step 2: Run it to confirm it fails**

Run: `go test ./core/capability/formula/ -run TestFunctionValueMarshalsDisplayOnly`
Expected: FAIL — cannot pass until `FUNCTION` evaluates (Tasks 4–5); the marshal path needs `inspectValue` support so `admitValue` does not error first.

- [ ] **Step 3: Handle the kind in `inspectValue`**

In `evaluate.go`, add to the `switch value.Kind()` in `inspectValue`, before `default`:

```go
	case KindFunction:
		if value.fn == nil {
			return 0, errorAt(ErrorType, span, "function value has no payload")
		}
		return 2 + escapedSizeBound(value.fn.source), nil
```

- [ ] **Step 4: Update the companion, build**

Update `evaluate.go.md` to match. Run: `go build ./core/capability/formula/`

- [ ] **Step 5: Commit**

```bash
git add core/capability/formula/evaluate.go core/capability/formula/evaluate.go.md core/capability/formula/value_test.go
git commit -m "feat(formula): bound function values in output inspection"
```

---

### Task 3: The `Resolver` port

**Files:**
- Modify: `core/capability/formula/evaluate.go`
- Modify: `core/capability/formula/evaluate.go.md`
- Test: `core/capability/formula/evaluate_test.go`

**Interfaces:**
- Produces:
  - `type Resolver interface { Resolve(name string) (value Value, ok bool, err error) }`
  - `func (b Bindings) Resolve(name string) (Value, bool, error)`
  - `func (s *Service) EvaluateWith(source string, resolver Resolver) (Value, error)`
  - `func (s *Service) EvaluateExpressionWith(expression *Expression, resolver Resolver) (Value, error)`
  - `evaluator` gains `resolver Resolver` and `source string`; `bindings` field removed.

- [ ] **Step 1: Write the failing test**

```go
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
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `go test ./core/capability/formula/ -run TestEvaluateWithResolver`
Expected: FAIL — `EvaluateWith` undefined.

- [ ] **Step 3: Introduce the port and rewire the evaluator**

In `evaluate.go`, add after the `Bindings` type:

```go
// Resolver is the evaluator's only channel for resolving a top-level
// identifier. Bindings implements it, so the map-based API is unchanged; the
// name manager provides a resolver over an immutable snapshot of stored names.
// Determinism holds only if the resolver itself is deterministic.
type Resolver interface {
	Resolve(name string) (value Value, ok bool, err error)
}

// Resolve makes a Bindings map a Resolver.
func (b Bindings) Resolve(name string) (Value, bool, error) {
	v, ok := b[name]
	return v, ok, nil
}
```

Replace the `evaluator` struct's `bindings Bindings` field with:

```go
	resolver Resolver
	source   string
```

Rewrite `EvaluateExpression` to delegate, and add the resolver entry points:

```go
// EvaluateExpression evaluates an already parsed expression against bindings.
func (s *Service) EvaluateExpression(expression *Expression, bindings Bindings) (Value, error) {
	return s.EvaluateExpressionWith(expression, bindings)
}

// EvaluateWith parses and evaluates source against a resolver.
func (s *Service) EvaluateWith(source string, resolver Resolver) (Value, error) {
	expression, err := s.Parse(source)
	if err != nil {
		return Value{}, err
	}
	return s.EvaluateExpressionWith(expression, resolver)
}

// EvaluateExpressionWith evaluates an already parsed expression against a
// resolver. It rejects an unknown language version rather than silently applying
// current semantics.
func (s *Service) EvaluateExpressionWith(expression *Expression, resolver Resolver) (Value, error) {
	if err := validateExpression(expression, s.Limits()); err != nil {
		return Value{}, err
	}
	evaluator := evaluator{limits: s.Limits(), resolver: resolver, source: expression.Source}
	value, err := evaluator.eval(expression.Root, 1)
	if err != nil {
		return Value{}, err
	}
	if err := evaluator.admitValue(value, expression.Root.Span, 1); err != nil {
		return Value{}, err
	}
	return value.clone(), nil
}
```

Update `resolveIdentifier` to read through the resolver (its query/row behaviour is preserved; the scope chain is added in Task 5). Replace the current body's binding lookup:

```go
	value, ok, rerr := Value{}, false, error(nil)
	if e.resolver != nil {
		value, ok, rerr = e.resolver.Resolve(name)
	}
	if rerr != nil {
		return Value{}, errorAt(ErrorUnknownIdentifier, span, "resolve %q: %v", name, rerr)
	}
	if !ok {
		return Value{}, errorAt(ErrorUnknownIdentifier, span, "unknown identifier %q", name)
	}
	if err := e.admitValue(value, span, depth); err != nil {
		return Value{}, err
	}
	return value.clone(), nil
```

(The `e.rowScope` branch above it is unchanged.)

- [ ] **Step 4: Update the companion, run the full package tests**

Update `evaluate.go.md`. Run: `go test ./core/capability/formula/`
Expected: PASS — all existing tests still pass (the `Bindings` path is preserved), plus `TestEvaluateWithResolver`.

- [ ] **Step 5: Commit**

```bash
git add core/capability/formula/evaluate.go core/capability/formula/evaluate.go.md core/capability/formula/evaluate_test.go
git commit -m "feat(formula): resolve identifiers through a Resolver port"
```

---

### Task 4: Parse `FUNCTION` / `LAMBDA` and postfix apply

**Files:**
- Modify: `core/capability/formula/syntax.go`
- Modify: `core/capability/formula/syntax.go.md`
- Test: `core/capability/formula/syntax_test.go`

**Interfaces:**
- Produces:
  - `NodeFunction NodeType = "function"`, `NodeApply NodeType = "apply"`
  - `Node` gains `Params []FieldName json:"params,omitempty"` (body stored in `Target`).
  - `parseFunction`; a postfix `(` case in `parsePostfix`; `validateExpression` cases for both.

- [ ] **Step 1: Write the failing test**

Add to `core/capability/formula/syntax_test.go`:

```go
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
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `go test ./core/capability/formula/ -run TestParseFunctionAndApply`
Expected: FAIL — `FUNCTION(...)` parses as a call and would later be `unknown_function`; apply forms are parse errors.

- [ ] **Step 3: Add node types, the `Params` field, and the parser branches**

In `syntax.go` add to the `NodeType` const block:

```go
	NodeFunction NodeType = "function"
	NodeApply    NodeType = "apply"
```

Add to the `Node` struct (next to `Projection`):

```go
	Params []FieldName `json:"params,omitempty"`
```

In `parsePrimary`, inside `case tokenIdent:` after the `true/false/null` switch and the `if !p.match(tokenLParen) { … NodeName … }` guard, branch to `parseFunction` before building the call:

```go
		if name := lowerASCII(tok.lit); name == "function" || name == "lambda" {
			return p.parseFunction(tok, depth+1)
		}
		args, close, err := p.parseDelimited(depth+1, tokenRParen, "function arguments")
```

(The `(` was already consumed by `p.match(tokenLParen)`.)

Add `parseFunction`:

```go
// parseFunction parses FUNCTION(p1, …, body) / LAMBDA(…). The opening '(' has
// already been consumed. Every argument but the last is a bare parameter
// identifier; the last is the body expression. Zero parameters are allowed.
func (p *parser) parseFunction(fn token, depth int) (*Node, *FormulaError) {
	args, close, err := p.parseDelimited(depth, tokenRParen, "function definition")
	if err != nil {
		return nil, err
	}
	if len(args) < 1 {
		return nil, errorAt(ErrorParse, Span{Start: fn.span.Start, End: close.span.End}, "%s requires a body expression", upperASCII(fn.lit))
	}
	params := make([]FieldName, 0, len(args)-1)
	seen := map[string]bool{}
	for _, arg := range args[:len(args)-1] {
		if arg.Type != NodeName {
			return nil, errorAt(ErrorParse, arg.Span, "function parameters must be identifiers")
		}
		if seen[arg.Name] {
			return nil, errorAt(ErrorParse, arg.Span, "duplicate function parameter %q", arg.Name)
		}
		seen[arg.Name] = true
		params = append(params, FieldName{Name: arg.Name, Span: arg.Span})
	}
	return p.node(Node{
		Type:   NodeFunction,
		Span:   Span{Start: fn.span.Start, End: close.span.End},
		Params: params,
		Target: args[len(args)-1],
	})
}
```

In `parsePostfix`, add a case (alongside the `tokenDot` / `tokenLBracket` cases):

```go
		case p.match(tokenLParen):
			args, close, err := p.parseDelimited(depth+1, tokenRParen, "call arguments")
			if err != nil {
				return nil, err
			}
			target, err = p.node(Node{Type: NodeApply, Span: Span{Start: target.Span.Start, End: close.span.End}, Target: target, Args: args})
			if err != nil {
				return nil, err
			}
```

In `validateExpression`, add cases before `default`:

```go
		case NodeFunction:
			if len(current.node.Params) > limits.MaxFields {
				return limitError(current.node.Span, "fields")
			}
			seen := make(map[string]bool, len(current.node.Params))
			for _, param := range current.node.Params {
				if param.Name == "" || !validFieldName(param.Name) {
					return errorAt(ErrorParse, param.Span, "function parameter name is empty or invalid")
				}
				if seen[param.Name] {
					return errorAt(ErrorParse, param.Span, "duplicate function parameter %q", param.Name)
				}
				seen[param.Name] = true
			}
			if err := push(current.node.Target); err != nil {
				return err
			}
		case NodeApply:
			if err := push(current.node.Target); err != nil {
				return err
			}
			if err := pushMany(current.node.Args); err != nil {
				return err
			}
```

- [ ] **Step 4: Update the companion, run tests**

Update `syntax.go.md`. Run: `go test ./core/capability/formula/`
Expected: PASS (existing parse tests unaffected; new `TestParseFunctionAndApply` passes). Evaluation of these forms comes in Task 5.

- [ ] **Step 5: Commit**

```bash
git add core/capability/formula/syntax.go core/capability/formula/syntax.go.md core/capability/formula/syntax_test.go
git commit -m "feat(formula): parse FUNCTION/LAMBDA definitions and postfix apply"
```

---

### Task 5: Evaluate functions — closures, apply, and non-builtin calls

**Files:**
- Modify: `core/capability/formula/evaluate.go`
- Modify: `core/capability/formula/evaluate.go.md`
- Modify: `core/capability/formula/function.go` (add `captured *scope`)
- Modify: `core/capability/formula/function.go.md`
- Modify: `core/capability/formula/functions.go`
- Modify: `core/capability/formula/functions.go.md`
- Test: `core/capability/formula/evaluate_test.go`

**Interfaces:**
- Consumes: `NodeFunction`, `NodeApply`, `functionValue`, `Resolver`.
- Produces: `scope` type; `evaluator.scope`; `resolveOptional`; `apply`; `makeFunction`; `evalCall` splits builtins from user-function application via `isBuiltinCall`.

- [ ] **Step 1: Write the failing test**

```go
func TestEvaluateFunctions(t *testing.T) {
	cases := map[string]string{
		"FUNCTION(x, x * 2)(21)":                 "42",
		"FUNCTION(a, b, a + b)(2, 3)":            "5",
		"(FUNCTION(n, n * n))(5)":                "25",
		"FUNCTION(f, x, f(x))(FUNCTION(n, n * n), 6)": "36",
		"FUNCTION(x, x)(FUNCTION(y, y + 1))(9)":  "10", // returns a function, then applies it
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
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `go test ./core/capability/formula/ -run TestEvaluateFunctions`
Expected: FAIL — functions do not evaluate yet.

- [ ] **Step 3: Add the scope, resolution, application, and the two new eval cases**

In `evaluate.go`, add the scope type and fields. Add to the `evaluator` struct:

```go
	scope *scope
```

Add the type near `queryRowScope`:

```go
// scope is one frame of a function's lexical environment: parameter (and
// enclosing) bindings, chained to the scope captured at definition. It is nil
// outside any function application, so non-function evaluation is unchanged.
type scope struct {
	names  map[string]Value
	parent *scope
}
```

In `function.go`, add the `captured *scope` field to `functionValue` (kept nil for a top-level/registered function; set to the defining scope for an inline lambda) and update `function.go.md`.

Add resolution and application helpers in `evaluate.go`:

```go
// resolveOptional resolves an identifier without erroring when it is absent:
// function scope (lexical) first, then the current query row, then the root
// resolver. It returns found=false when nothing matches.
func (e *evaluator) resolveOptional(name string, span Span, depth int) (Value, bool, *FormulaError) {
	for s := e.scope; s != nil; s = s.parent {
		if value, ok := s.names[name]; ok {
			if err := e.admitValue(value, span, depth); err != nil {
				return Value{}, false, err
			}
			return value.clone(), true, nil
		}
	}
	if e.rowScope != nil {
		if pos, ok := e.rowScope.index[name]; ok {
			value := e.rowScope.row[pos]
			if err := e.admitValue(value, span, depth); err != nil {
				return Value{}, false, err
			}
			return value.clone(), true, nil
		}
	}
	if e.resolver != nil {
		value, ok, rerr := e.resolver.Resolve(name)
		if rerr != nil {
			return Value{}, false, errorAt(ErrorUnknownIdentifier, span, "resolve %q: %v", name, rerr)
		}
		if ok {
			if err := e.admitValue(value, span, depth); err != nil {
				return Value{}, false, err
			}
			return value.clone(), true, nil
		}
	}
	return Value{}, false, nil
}

// makeFunction builds a function value from a NodeFunction, capturing the
// current lexical scope and the exact source text (for display and equality).
func (e *evaluator) makeFunction(node *Node) Value {
	params := make([]string, len(node.Params))
	for i, param := range node.Params {
		params[i] = param.Name
	}
	source := ""
	if node.Span.Start >= 0 && node.Span.End <= len(e.source) {
		source = e.source[node.Span.Start:node.Span.End]
	}
	return Value{kind: KindFunction, fn: &functionValue{
		params:   params,
		body:     node.Target,
		source:   source,
		captured: e.scope,
	}}
}

// apply calls a function value with already-evaluated arguments. It charges one
// step and evaluates the body one level deeper, so recursion terminates against
// MaxSteps and MaxDepth. Parameters bind in a new frame over the function's
// captured scope, so closures are lexical.
func (e *evaluator) apply(fn Value, args []Value, span Span, depth int) (Value, *FormulaError) {
	if fn.Kind() != KindFunction || fn.fn == nil {
		return Value{}, errorAt(ErrorType, span, "value of kind %s is not callable", fn.Kind())
	}
	if len(args) != len(fn.fn.params) {
		return Value{}, errorAt(ErrorWrongArity, span, "function expects %d argument(s), got %d", len(fn.fn.params), len(args))
	}
	if err := e.charge(span, 1); err != nil {
		return Value{}, err
	}
	names := make(map[string]Value, len(fn.fn.params))
	for i, param := range fn.fn.params {
		names[param] = args[i]
	}
	previous := e.scope
	e.scope = &scope{names: names, parent: fn.fn.captured}
	defer func() { e.scope = previous }()
	return e.eval(fn.fn.body, depth+1)
}
```

Rewrite `resolveIdentifier` to reuse `resolveOptional`:

```go
// resolveIdentifier resolves a bare identifier or reports unknown_identifier.
func (e *evaluator) resolveIdentifier(name string, span Span, depth int) (Value, *FormulaError) {
	value, ok, err := e.resolveOptional(name, span, depth)
	if err != nil {
		return Value{}, err
	}
	if !ok {
		return Value{}, errorAt(ErrorUnknownIdentifier, span, "unknown identifier %q", name)
	}
	return value, nil
}
```

Add the two new `eval` cases (in the `switch node.Type` in `eval`):

```go
	case NodeFunction:
		value := e.makeFunction(node)
		if err := e.admitValue(value, node.Span, depth); err != nil {
			return Value{}, err
		}
		return value, nil
	case NodeApply:
		target, err := e.eval(node.Target, depth+1)
		if err != nil {
			return Value{}, err
		}
		args := make([]Value, len(node.Args))
		for i, arg := range node.Args {
			argValue, err := e.eval(arg, depth+1)
			if err != nil {
				return Value{}, err
			}
			args[i] = argValue
		}
		value, err := e.apply(target, args, node.Span, depth)
		if err != nil {
			return Value{}, err
		}
		if err := e.admitValue(value, node.Span, depth); err != nil {
			return Value{}, err
		}
		return value, nil
```

- [ ] **Step 4: Route non-builtin calls to application in `functions.go`**

In `functions.go`, at the top of `evalCall`, split builtins from user-function calls:

```go
func (e *evaluator) evalCall(node *Node, depth int) (Value, *FormulaError) {
	name := upperASCII(node.Name)
	if !isBuiltinCall(name) {
		fn, found, err := e.resolveOptional(node.Name, node.Span, depth)
		if err != nil {
			return Value{}, err
		}
		if !found {
			return Value{}, errorAt(ErrorUnknownFunction, node.Span, "unknown function %q", node.Name)
		}
		if fn.Kind() != KindFunction {
			return Value{}, errorAt(ErrorType, node.Span, "%q is not a function", node.Name)
		}
		args := make([]Value, len(node.Args))
		for i, arg := range node.Args {
			value, argErr := e.eval(arg, depth)
			if argErr != nil {
				return Value{}, argErr
			}
			args[i] = value
		}
		return e.apply(fn, args, node.Span, depth)
	}
	if err := validateCall(name, len(node.Args), node.Span); err != nil {
		return Value{}, err
	}
	// ... existing IF special form + arg evaluation + builtin switch unchanged ...
}
```

Add the helper:

```go
// isBuiltinCall reports whether an (already upper-cased) call name is a builtin.
// A non-builtin name is a user-function application resolved from scope or the
// resolver. FUNCTION/LAMBDA never reach here (they parse to NodeFunction).
func isBuiltinCall(name string) bool {
	switch name {
	case "SUM", "PRODUCT", "MIN", "MAX", "AVG", "AVERAGE", "COUNT", "ABS", "MOD",
		"POWER", "POW", "ROUND", "FLOOR", "CEIL", "CEILING", "TABLE", "ROWS", "COLUMNS", "IF":
		return true
	default:
		return false
	}
}
```

`NOPE(1 / 0)` stays `unknown_function` because the not-found branch returns before evaluating args.

- [ ] **Step 5: Update companions, run the full package tests**

Update `evaluate.go.md`, `function.go.md`, and `functions.go.md`. Run:

```bash
go test ./core/capability/formula/
```

Expected: PASS — `TestEvaluateFunctions`, `TestFunctionValueKindAndShape`, `TestFunctionValueMarshalsDisplayOnly`, and every pre-existing test.

- [ ] **Step 6: Commit**

```bash
git add core/capability/formula/evaluate.go core/capability/formula/evaluate.go.md \
        core/capability/formula/function.go core/capability/formula/function.go.md \
        core/capability/formula/functions.go core/capability/formula/functions.go.md \
        core/capability/formula/evaluate_test.go
git commit -m "feat(formula): evaluate functions with lexical closures and apply"
```

---

### Task 6: Limits, safety, and edge-case tests

**Files:**
- Test: `core/capability/formula/evaluate_test.go`
- (No production changes expected; if a test reveals a gap, fix it in the relevant file + its `.go.md` in the same commit.)

**Interfaces:**
- Consumes: everything from Tasks 1–5.

- [ ] **Step 1: Write the tests**

```go
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
```

- [ ] **Step 2: Run the tests**

Run: `go test ./core/capability/formula/ -run TestFunctionSafetyAndEdges`
Expected: PASS. If recursion does not hit a limit, confirm `apply` charges a step and `eval` deepens `depth` (it should, per Task 5). If `SELECT(...)` regressed, confirm `isBuiltinCall` excludes `SELECT`.

- [ ] **Step 3: Run the whole suite and vet**

```bash
go vet ./core/capability/formula/
go test ./...
```

Expected: PASS across the module.

- [ ] **Step 4: Commit**

```bash
git add core/capability/formula/evaluate_test.go
git commit -m "test(formula): cover function recursion limits and edge cases"
```

---

### Task 7: Docs, change record, and companion verification

**Files:**
- Create: `docs/architecture/capabilities/formula/functions.md`
- Modify: `docs/architecture/capabilities/formula/README.md` (link the new page)
- Modify: `docs/architecture/capabilities/formula/supported-formulas.md` (add `FUNCTION`/`LAMBDA`, apply, the function type)
- Create: `docs/records/0021-formula-functions.md`

**Interfaces:**
- Consumes: the shipped behaviour from Tasks 1–6.

- [ ] **Step 1: Write the architecture page**

Create `docs/architecture/capabilities/formula/functions.md` covering: the `function` value type (scalar, non-serializable, display-only JSON); `FUNCTION(p…, body)` / `LAMBDA` definition; the postfix apply operator and how `name(args)` dispatches (builtin vs. resolved function vs. `unknown_function`); lexical closures with late binding to the root resolver; and the safety story (per-call step + depth). Link it from the formula `README.md`, and add the syntax to `supported-formulas.md`. Ground every claim in the code (link to `syntax.go` / `evaluate.go` / `function.go`).

- [ ] **Step 2: Write the change record**

Create `docs/records/0021-formula-functions.md` — one `##` per file changed (`value.go`, `function.go`, `evaluate.go`, `syntax.go`, `functions.go`), each with `###` entries stating what changed, the goal, and why. Note explicitly: additive only; `Resolver` port added with `Bindings` preserved; functions non-serializable; DoS bounds unchanged.

- [ ] **Step 3: Verify every companion is byte-verbatim**

Run the repo's extract-and-diff check for each touched/created `*.go` against its `*.go.md` (concatenated ```go blocks must reproduce the source exactly, tabs preserved):

```bash
for f in value function evaluate syntax functions; do
  # extract ```go blocks from the .go.md and diff against the .go source
  awk '/^```go$/{f=1;next}/^```$/{f=0}f' "core/capability/formula/$f.go.md" \
    | diff - "core/capability/formula/$f.go" && echo "OK $f" || echo "DRIFT $f"
done
```

Expected: `OK` for every file. Fix any `DRIFT` before committing.

- [ ] **Step 4: Final build/vet/test**

```bash
go build ./... && go vet ./... && go test ./...
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/architecture/capabilities/formula/functions.md \
        docs/architecture/capabilities/formula/README.md \
        docs/architecture/capabilities/formula/supported-formulas.md \
        docs/records/0021-formula-functions.md
git commit -m "docs(formula): document user-defined functions and record the change"
```

---

## Self-Review

**Spec coverage (Part 1 of the design):**
- `KindFunction` scalar value type — Task 1. ✅
- `FUNCTION`/`LAMBDA` definition, positional params + body — Task 4. ✅
- Postfix apply, builtin-vs-resolved-vs-unknown dispatch — Tasks 4–5. ✅
- Lexical closures with late binding to the namespace — Task 5. ✅
- Safety (step + depth per application) — Tasks 5–6. ✅
- No serialization (display-only marshal, decode rejected) — Tasks 1–2. ✅
- `Resolver` port with `Bindings` preserved + `EvaluateWith` — Task 3. ✅
- Compatibility (additive; `unknown_function` contract kept) — Tasks 5–6. ✅
- Docs + record + companions — Task 7. ✅

**Deferred to later increments (not this plan):** the `formula/names` package, storage, endpoints, wiring — Increments 2–4, planned after this lands.

**Type consistency:** `functionValue{params, body, source, captured}` is used identically across `function.go`, `evaluate.go` (`makeFunction`, `apply`), and `value.go` (`Equal`, `String`, `MarshalJSON`). `resolveOptional` is the single resolution path used by `resolveIdentifier`, `evalCall`, and `matchPredicate`'s field lookups. Body is stored in `Node.Target` consistently between `parseFunction` and `makeFunction`.

**Risk notes:**
- `2(3)` / `(1+1)(3)` change from parse error to `type_error` (a value is applied). Intended and tested.
- Adding `captured *scope` to `functionValue` couples the value payload to an evaluator-internal type within the same package; acceptable and necessary for first-class closures.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-21-formula-functions.md`. This is **Increment 1 of 4**; Increments 2–4 (name manager, constructive tables, wiring) get their own plans once this lands, since their signatures depend on how this shakes out.
