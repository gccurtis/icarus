# 0021 — User-defined `FUNCTION`/`LAMBDA` support

Formula gains first-class, user-defined functions: `FUNCTION(p..., body)` /
`LAMBDA(p..., body)` produce a `function` value, and a postfix apply operator
calls any value — a resolved function, an inline definition, or a function
stored in a field — with evaluated arguments. Functions are lexical closures
over the scope active where they were defined, and free identifiers inside a
function body resolve **late**, against the root resolver, each time the
function is applied.

This is Increment 1 of 4 in the design: the name manager, constructive tables,
and wiring that will let stored/named functions plug into the new `Resolver`
port are separate, later increments. Landed across five commits
(`a2539ba..0390889`), delivered as a stack: value payload → output-inspection
bound → resolver port → parser → evaluator → recursion/edge-case tests.

Design decisions, stated explicitly:

- **Additive only.** Every existing `formula/v1` construct, error kind, and
  limit is unchanged; the only new observable surface is the `function` kind,
  the `FUNCTION`/`LAMBDA` primary form, and the postfix apply operator. No
  existing formula's parse or evaluation result changes. The one contract
  narrowing is deliberate and tested: applying a non-function value (`2(3)`,
  `(1 + 1)(3)`) changes from a *parse* error (no apply syntax existed) to a
  *runtime* `type_error` (a value is applied and rejected) — this is a new
  capability being exercised, not a behavior change to old formulas.
- **`Resolver` port added; `Bindings` preserved.** `Resolver` is now the
  evaluator's only channel for top-level identifier lookup. `Bindings`
  implements `Resolver`, so the existing map-based `Evaluate`/
  `EvaluateExpression` API and every caller of it are unchanged bit-for-bit.
  `EvaluateWith`/`EvaluateExpressionWith` are new resolver-based entry points,
  added ahead of the name manager that will supply a `Resolver` over stored
  names in a later increment.
- **Function values are non-serializable.** `MarshalJSON` renders a function
  display-only (`params` + `source` text, no captured scope); `UnmarshalJSON`
  rejects a `function` kind outright. A decoded function would have no
  closure to run against, so round-tripping one would silently produce a
  different function than the one encoded — refusing it is safer than a
  partially-correct decode.
- **DoS bounds unchanged.** No new `Limits` field was added. Applying a
  function charges one step (`MaxSteps`) and evaluates its body one level
  deeper (`MaxDepth`), so unbounded recursion still terminates as
  `limit_exceeded` against the existing ceilings. A function's parameter list
  is bounded by the existing `MaxFields`, and `FUNCTION`/`LAMBDA`/apply nodes
  count against the existing `MaxNodes` and parse `MaxDepth` like any other
  AST shape.

## `core/capability/formula/value.go`

### `KindFunction` scalar kind

```go
KindFunction Kind = "function"
```

**What / goal / why:** adds `function` as an eighth scalar `Kind` alongside
`null`/`number`/`text`/`logic`/`list`/`record`/`table`. Goal: give a function
the same first-class status — a typed `Value` — as every other Formula
payload, rather than a special out-of-band callable. `Value` also gained an
`fn *functionValue` field to carry the payload.

### Deep equality, display, and JSON for `function`

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

**What / goal / why:** `Equal` compares two functions structurally — same
parameter names in order and identical source text — rather than by captured
scope. Goal: two independently defined but textually identical functions
compare equal, matching how every other Formula value is structural rather
than reference-identity based. `String()` renders a function as its exact
source text (`v.fn.source`, or `<function>` for a zero-value payload), so a
function displays the way it was written.

### Display-only, non-decodable JSON encoding

```go
case KindFunction:
    if v.fn == nil {
        return nil, fmt.Errorf("formula: function value has no payload")
    }
    out.Params = append([]string(nil), v.fn.params...)
    source := v.fn.source
    out.Source = &source
```
```go
case KindFunction:
    return fmt.Errorf("formula: function values cannot be decoded")
```

**What / goal / why:** `MarshalJSON` adds `params`/`source` wire fields and
encodes a function as `{"kind": "function", "shape": {...}, "params": [...],
"source": "..."}` — enough to show what the function is. `UnmarshalJSON`
rejects the `function` kind unconditionally. Goal: keep the wire form honest.
A function's real payload is its captured lexical scope, which cannot be
serialized; allowing decode would either silently drop the closure (producing
a function that behaves differently from the one encoded) or require
inventing a serialization format for closures that this increment does not
need. Rejecting decode is the safe, explicit choice, consistent with "additive
only" — no existing wire consumer is affected, since no prior version could
produce a `function`-kind payload to decode in the first place.

## `core/capability/formula/function.go`

### `functionValue` payload (new file)

```go
type functionValue struct {
	params   []string
	body     *Node
	source   string
	captured *scope
}
```

**What / goal / why:** the immutable payload behind a `KindFunction` value:
ordered parameter names, the parsed (unevaluated) body, the exact source text
(for display/equality), and the lexical scope captured at definition. Landed
in two steps — `params`/`body`/`source` first, `captured *scope` once the
`scope` type existed in `evaluate.go` — so the type never referenced an
undefined symbol. Goal: keep a function's definition-time data (what it is)
separate from evaluator machinery (how it runs), while still letting the
value close over its defining scope for lexical, not dynamic, scoping.
Coupling `captured *scope` — an evaluator-internal type — into the value
payload is an intentional, package-internal trade: both types live in
`formula`, and first-class closures need the value to carry its environment.

### `functionShapeFields` / `functionShapeRows`

```go
const (
	functionShapeFields = 1
	functionShapeRows   = 1
)
```

**What / goal / why:** documented a function value's scalar shape (`1 × 1`),
matching how every other scalar kind's `Shape()` falls back to `{Fields: 1,
Rows: 1}` when there is no table carrier. **Removed in the Fix wave (final
review)** below: the constants were never read by `Shape()` or anywhere else
in Go code, so they were dead weight; the shape fact is now stated only in
`function.go.md`'s prose.

## `core/capability/formula/syntax.go`

### `NodeFunction` / `NodeApply` node types and fields

```go
NodeFunction    NodeType = "function"
NodeApply       NodeType = "apply"
```
```go
Params     []FieldName   `json:"params,omitempty"`
```

**What / goal / why:** two new public AST node shapes. `NodeFunction` holds a
`FUNCTION`/`LAMBDA` definition's parameter names (`Params`, reusing the
existing `FieldName` type) and body (`Target`). `NodeApply` holds an applied
target (`Target`) and its evaluated argument list (`Args`, reusing the
existing field already used by `NodeCall`). Goal: represent both new forms
with the smallest addition to the existing `Node` shape, so the JSON AST stays
uniform.

### Postfix apply — `target(args...)` on any expression

```go
case p.match(tokenLParen):
    args, close, err := p.parseDelimited(depth+1, tokenRParen, "call arguments")
    if err != nil {
        return nil, err
    }
    target, err = p.node(Node{Type: NodeApply, Span: Span{Start: target.Span.Start, End: close.span.End}, Target: target, Args: args})
```

**What / goal / why:** adds `(args...)` as a new postfix continuation inside
`parsePostfix`, alongside `.field`, `[index]`, `.{...}`, and `!`/`?`. Goal:
let *any* postfix result be applied — a parenthesized group, a chained call's
result, a field access, an inline `FUNCTION`/`LAMBDA` — not only a bare name.
This is what makes `(FUNCTION(x, x * x))(5)` and chained application like
`f(x)(y)` parse.

### `FUNCTION`/`LAMBDA` primary form

```go
if name := lowerASCII(tok.lit); name == "function" || name == "lambda" {
    return p.parseFunction(tok, depth+1)
}
```
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

**What / goal / why:** intercepts the identifier-call path in `parsePrimary`
before it falls through to a generic `NodeCall`, ASCII case-insensitively (so
`function`/`Function`/`FUNCTION` and `lambda`/`LAMBDA` are the same
construct, matching how every other function name is case-insensitive). Every
argument but the last must be a bare identifier naming a parameter; the last
is the body. Goal: at least a body is required (`FUNCTION()` is a parse
error), but zero parameters are explicitly allowed (`FUNCTION(7)` is a valid
thunk), and duplicate or non-identifier parameters are rejected at parse time
rather than deferred to evaluation.

### Bounding the two new node shapes in `validateExpression`

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

**What / goal / why:** `validateExpression` re-validates a parsed (or
deserialized/caller-built) AST's structure and limits — this is the same
function that already bounds every other node shape's fields/children and
depth. Goal: `NodeFunction`'s parameter count is bounded by the existing
`MaxFields` (the same ceiling used for record/table field counts) and
re-checked for validity/duplication; `NodeFunction`/`NodeApply` children are
pushed onto the traversal stack so they count toward the existing node-count
and depth limits like every other node. No new limit was introduced.

## `core/capability/formula/evaluate.go`

### `Resolver` port, with `Bindings` preserved

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
```go
// EvaluateWith parses and evaluates source against a resolver.
func (s *Service) EvaluateWith(source string, resolver Resolver) (Value, error) {
```
```go
// EvaluateExpressionWith evaluates an already parsed expression against a
// resolver. It rejects an unknown language version rather than silently applying
// current semantics.
func (s *Service) EvaluateExpressionWith(expression *Expression, resolver Resolver) (Value, error) {
```

**What / goal / why:** the evaluator's `bindings Bindings` field becomes
`resolver Resolver`; `Bindings` gains a `Resolve` method that satisfies the
new interface, so `Evaluate`/`EvaluateExpression` (which now delegate to
`EvaluateExpressionWith`) keep their exact existing signature and behavior —
**the map-based API is unchanged**. Goal: give the evaluator one resolution
channel that can be backed by a plain map today and, in a later increment, by
a name manager's resolver over an immutable snapshot of stored names, without
another evaluator change. `EvaluateWith`/`EvaluateExpressionWith` are the new
resolver-based entry points; `EvaluateExpression` is now a one-line wrapper.
The evaluator initially also gained a `source string` field (the original
expression text) so a function's captured source could be sliced from it at
evaluation time; that field was removed in the Fix wave (final review) below
once source capture moved to parse time.

### Lexical `scope` chain and `resolveOptional`

```go
// scope is one frame of a function's lexical environment: parameter (and
// enclosing) bindings, chained to the scope captured at definition. It is nil
// outside any function application, so non-function evaluation is unchanged.
type scope struct {
	names  map[string]Value
	parent *scope
}
```
```go
// resolveOptional resolves an identifier without erroring when it is absent:
// function scope (lexical) first, then the current query row, then the root
// resolver. It returns found=false when nothing matches.
func (e *evaluator) resolveOptional(name string, span Span, depth int) (Value, bool, *FormulaError) {
```

**What / goal / why:** the evaluator gains a `scope *scope` field (nil outside
any function application, so ordinary evaluation is unchanged) and
`resolveOptional` replaces the previous inline `resolveIdentifier` body as the
one lookup path, checked in order: the function scope chain (innermost frame
first, so a nested function sees its own parameters before an enclosing
function's), then the current query row (unchanged from record 0020's
field-first rule), then the root `Resolver`. Goal: one function that both
`resolveIdentifier` (bare-identifier evaluation, now `unknown_identifier` on
miss) and `evalCall` (user-function-call resolution, now `unknown_function`
on miss) delegate to, so the resolution order is defined exactly once.

### `makeFunction` and `apply`

```go
// makeFunction builds a function value from a NodeFunction, capturing the
// current lexical scope and the exact source text (for display and equality).
func (e *evaluator) makeFunction(node *Node) Value {
```
```go
// apply calls a function value with already-evaluated arguments. It charges one
// step and evaluates the body one level deeper, so recursion terminates against
// MaxSteps and MaxDepth. Parameters bind in a new frame over the function's
// captured scope, so closures are lexical.
func (e *evaluator) apply(fn Value, args []Value, span Span, depth int) (Value, *FormulaError) {
```

**What / goal / why:** `makeFunction` builds the `KindFunction` value for a
`NodeFunction`, capturing `e.scope` (the closure) and copying the exact source
text from the node's own `Source` field. `apply` validates the target is
callable and arity matches, **charges one `MaxSteps` unit**, binds parameters
in a new frame chained onto the function's *captured* scope (not the caller's
current scope — this is what makes closures lexical rather than dynamic), and
evaluates the body **one `MaxDepth` level deeper**. Goal: reuse the identical
step/depth machinery every other evaluation already goes through, so
unbounded recursion is bounded the same way an arbitrarily nested expression
already was — no new limit needed.

**Revised in the Fix wave (final review) below:** `makeFunction` originally
sliced the source text itself, out of `e.source[node.Span.Start:node.Span.End]`
— `e.source` being the evaluator's copy of the *top-level* expression's source.
That was only correct when the node's span originated from that same string.
A nested `NodeFunction` inside a function body is turned into a value only
when the *outer* function is applied — which can happen under a *different*
`e.source` than the one the inner node was parsed from (for example, a stored
function resolved through a `Resolver` and applied from another expression).
Slicing then indexed the wrong string, so `String()`/`Equal`/`MarshalJSON` of
a partially-applied inner closure could return `""` or garbage. The fix moves
source capture to parse time: `syntax.go`'s `parseFunction` now sets a new
`Node.Source` field from the parser's own (always-correct) source string, and
`makeFunction` just copies `node.Source` onto the payload. The evaluator's
`source` field, added only to support the old slicing, was removed.

### `NodeFunction` / `NodeApply` evaluation

```go
case NodeFunction:
    value := e.makeFunction(node)
    if err := e.admitValue(value, node.Span, depth); err != nil {
        return Value{}, err
    }
    return value, nil
case NodeApply:
    target, err := e.eval(node.Target, depth+1)
    ...
    value, err := e.apply(target, args, node.Span, depth)
    ...
```

**What / goal / why:** wires the two new node types into the main `eval`
switch. A `NodeFunction` builds and admits a function value like any other
literal. A `NodeApply` evaluates its target as an ordinary value first (so
applying a non-function is `type_error`, not a special case), evaluates its
arguments, then calls `apply` — the same path a resolved user-function call
in `evalCall` uses. Every produced value, including a function value itself,
still passes through `admitValue`.

### Bounding a function value in output inspection

```go
case KindFunction:
    if value.fn == nil {
        return 0, errorAt(ErrorType, span, "function value has no payload")
    }
    return 2 + escapedSizeBound(value.fn.source), nil
```

**What / goal / why:** `inspectValue` — the function `admitValue` uses to
enforce `MaxOutputBytes` — previously fell through to `invalid_value_kind` for
any kind it did not recognize, which would have rejected every function value
outright. Goal: bound a function's contribution to output size by its source
text length (`escapedSizeBound`), the same conservative heuristic used for
text payloads elsewhere, so a function is size-limited like every other
value instead of being an unbounded exception.

## `core/capability/formula/functions.go`

### `evalCall` splits builtins from user-function calls

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
	...
```

**What / goal / why:** `name(args)` first checks the ASCII-uppercased name
against the closed built-in registry (unchanged). If it is not a built-in, the
**exact, case-sensitive** name is resolved via `resolveOptional` — **before
any argument evaluates** — and applied if it resolves to a `function` value;
a name that is neither a built-in nor resolvable is `unknown_function`, and a
resolved-but-non-function value is `type_error`. Goal: `NOPE(1 / 0)` stays
`unknown_function` (never reaching the division) because name resolution is
checked first — the existing `unknown_function` contract for a genuinely
unknown name is preserved exactly, just reached by a new path (a case-
sensitive name resolution) alongside the pre-existing built-in dispatch.

### `isBuiltinCall`

```go
// isBuiltinCall reports whether an (already upper-cased) call name is a builtin.
// A non-builtin name is a user-function application resolved from scope or the
// resolver. FUNCTION/LAMBDA never reach here (they parse to NodeFunction).
func isBuiltinCall(name string) bool {
```

**What / goal / why:** extracts the exact set of built-in names `evalCall`
already dispatched on (`SUM`, `PRODUCT`, ..., `IF`) into a lookup used both to
decide the dispatch branch and, implicitly, to document that this set is
closed and unchanged by this increment — every name on it behaves exactly as
before.

## Tests & docs

`value_test.go` covers the `KindFunction` payload, equality, `String()`, and
the JSON encode/decode-rejection contract. `syntax_test.go`
(`TestParseFunctionAndApply`) covers valid and invalid `FUNCTION`/`LAMBDA`
definitions and apply parsing. `evaluate_test.go`
(`TestEvaluateFunctions`, `TestFunctionSafetyAndEdges`) covers application,
arity errors, late-bound free identifiers via `EvaluateWith`, non-function
application (`type_error`), zero-parameter functions, unbounded recursion
terminating as `limit_exceeded`, and the untouched `unknown_function` contract
for `NOPE`/`SELECT`. `docs/architecture/capabilities/formula/functions.md`
(new), `README.md`, and `supported-formulas.md` were updated to document the
shipped behavior; all five `.go.md` companions were kept byte-verbatim with
their `.go` sources in the same commits that changed them.
