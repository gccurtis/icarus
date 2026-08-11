# User-defined functions

Formula supports first-class, user-defined functions: `FUNCTION`/`LAMBDA`
expressions produce a `function` value, and a postfix apply operator calls any
value — a built-in name, a resolved function value, or an inline definition —
with evaluated arguments. Functions are lexical closures over the scope active
where they were defined, with names resolved late against the root resolver so
mutual dependencies work without a fixed declaration order.

The implementation is split between the value payload in
[`function.go`](../../../../core/capability/formula/function.go) and the
`KindFunction` tag in
[`value.go`](../../../../core/capability/formula/value.go), parsing in
[`syntax.go`](../../../../core/capability/formula/syntax.go), and evaluation —
closures, application, and call dispatch — in
[`evaluate.go`](../../../../core/capability/formula/evaluate.go) and
[`functions.go`](../../../../core/capability/formula/functions.go). Behavior is
exercised by
[`syntax_test.go`](../../../../core/capability/formula/syntax_test.go),
[`evaluate_test.go`](../../../../core/capability/formula/evaluate_test.go), and
[`value_test.go`](../../../../core/capability/formula/value_test.go).

## The `function` value

`KindFunction` is a scalar value kind alongside `null`, `number`, `text`,
`logic`, `list`, `record`, and `table`
([`value.go:17-26`](../../../../core/capability/formula/value.go#L17-L26)). Its
payload, `functionValue`, is immutable and holds the ordered parameter names,
the parsed (unevaluated) body `*Node`, the exact source text used for display
and equality, and the lexical scope captured at definition time
([`function.go`](../../../../core/capability/formula/function.go)). Like every
other scalar, it reports shape `1 × 1`.

A function value is **display-only** in JSON and cannot round-trip:

- `MarshalJSON` encodes it as `{"kind": "function", "shape": {...}, "params":
  [...], "source": "..."}` — enough to show what the function is, not enough
  to reconstruct its closure
  ([`value.go:611-617`](../../../../core/capability/formula/value.go#L611-L617)).
- `UnmarshalJSON` rejects a `function` kind outright: `"formula: function
  values cannot be decoded"`
  ([`value.go:652-653`](../../../../core/capability/formula/value.go#L652-L653)).

This is deliberate: a decoded function would have no captured scope to close
over, so allowing it in would silently produce a function that behaves
differently from the one that was encoded.

`Equal` compares two function values structurally — same parameter names in
the same order and identical source text — not by capturing scope, so two
independently defined but textually identical functions are equal
([`value.go:476-488`](../../../../core/capability/formula/value.go#L476-L488)).
`String()` renders a function as its exact source text
([`value.go:529-533`](../../../../core/capability/formula/value.go#L529-L533)).

## Defining a function: `FUNCTION` / `LAMBDA`

```text
FUNCTION(param, ..., body)
LAMBDA(param, ..., body)
```

`FUNCTION` and `LAMBDA` are the same construct — the parser accepts either
spelling, ASCII case-insensitively, as it does for other function names
([`syntax.go:1077-1079`](../../../../core/capability/formula/syntax.go#L1077-L1079)).
Every argument but the last must be a bare identifier naming a parameter; the
last argument is the body expression. At least one argument (the body) is
required, so `FUNCTION()` is a parse error, but **zero parameters are allowed**
— `FUNCTION(body)` is a thunk
([`syntax.go:1110-1139`](../../../../core/capability/formula/syntax.go#L1110-L1139)).
Parameter names must be valid identifiers and unique within the definition;
a duplicate or non-identifier parameter is a parse error. The parameter list
is bounded by the same `MaxFields` limit as record and table field counts
([`syntax.go:586-599`](../../../../core/capability/formula/syntax.go#L586-L599)).

```text
FUNCTION(x, x * 2)
LAMBDA(a, b, a + b)
FUNCTION(7)          -- zero parameters; the body is a constant
```

A `FUNCTION`/`LAMBDA` expression evaluates to a `function` value immediately —
defining a function does not evaluate its body, and never fails because a free
identifier inside the body happens to be unresolvable yet; that is only
checked when the function is applied
([`evaluate.go:301-306`](../../../../core/capability/formula/evaluate.go#L301-L306),
[`evaluate.go:717-734`](../../../../core/capability/formula/evaluate.go#L717-L734)).

## Applying a function: the postfix apply operator

Any postfix expression can be followed by `(args...)` to apply it, not only a
bare name — the same postfix position as `.field`, `[index]`, `.{...}`, and
`!`/`?`
([`syntax.go:817-825`](../../../../core/capability/formula/syntax.go#L817-L825)):

```text
double(21)                       -- named function, applied
(FUNCTION(x, x * x))(5)          -- inline definition, applied immediately
FUNCTION(x, x)(FUNCTION(y, y+1))(9)  -- a call chain: apply, then apply the result
record.fn(1, 2)                  -- a function stored in a field, applied
```

There are two dispatch paths, and which one an expression takes depends on its
shape, not on what it evaluates to:

- **`name(args)`** — an identifier immediately followed by `(` parses as a
  call node and is resolved through `evalCall`
  ([`functions.go:5-27`](../../../../core/capability/formula/functions.go#L5-L27)):
  1. if the ASCII-uppercased name matches a built-in (`SUM`, `IF`, `TABLE`,
     ...), it dispatches to that built-in;
  2. otherwise the exact (case-sensitive) name is resolved — function scope,
     then the current query row, then the root resolver — and if that
     resolves to a `function` value, it is applied to the evaluated
     arguments;
  3. otherwise the call is `unknown_function`.

  **The name is resolved before the arguments are evaluated.** `NOPE(1 / 0)`
  is `unknown_function`, not `divide_by_zero` — the division-by-zero in the
  unreachable argument never runs.
- **Any other postfix apply** — applying a group, a chained call result, a
  field/index result, or anything else that is not a bare identifier — goes
  through `NodeApply`
  ([`evaluate.go:307-327`](../../../../core/capability/formula/evaluate.go#L307-L327)).
  The target is evaluated as an ordinary value first; if it is not a
  `function`, applying it is `type_error` (there is no built-in fallback for
  a non-identifier target, since built-ins are not values). `5(3)` and
  `(1 + 1)(3)` are both `type_error` for this reason.

Either path ends in the same `apply`, which checks arity — the argument count
must equal the function's parameter count, or `wrong_arity` — and evaluates
the body with the parameters bound
([`evaluate.go:740-758`](../../../../core/capability/formula/evaluate.go#L740-L758)).

## Lexical closures with late binding

A function value captures the `scope` chain active at the point `FUNCTION`/
`LAMBDA` was evaluated
([`evaluate.go:717-734`](../../../../core/capability/formula/evaluate.go#L717-L734)).
Applying it builds a new frame — mapping each parameter to its argument value
— chained onto that captured scope, so a nested function sees its own
parameters first, then the parameters of any function it was defined inside,
in lexical (definition-site) order
([`evaluate.go:740-758`](../../../../core/capability/formula/evaluate.go#L740-L758)).

Identifier resolution inside a function body — and everywhere else — goes
through one function, `resolveOptional`, in this order
([`evaluate.go:681-715`](../../../../core/capability/formula/evaluate.go#L681-L715)):

1. the function scope chain (innermost frame first);
2. the current query row, if a `.{...}` query is in progress;
3. the root `Resolver` (`Bindings`, or a caller's own `Resolver` implementation
   passed to `EvaluateWith`).

A name that is free in a function body — not one of its own parameters, and
not bound by any enclosing function — is therefore **not** captured by value
at definition time. It is looked up against the root resolver each time the
function runs, i.e. **late-bound**:

```text
scale = FUNCTION(n, n * factor)   -- factor is free
```

Evaluating `scale(4)` with `factor` bound to `10` in the resolver yields `40`;
if the resolver's binding for `factor` changes between calls, later
applications see the new value. This also means recursion works without any
special declaration: a function looked up from the resolver can call itself by
name, because the name is re-resolved on each application rather than fixed
once at definition time.

## Safety: bounded by the same step and depth ceilings

User-defined functions introduce no new safety mechanism — they are bounded by
the existing deterministic limits:

- **One step per application.** `apply` charges one unit against `MaxSteps`
  before evaluating the body
  ([`evaluate.go:747-749`](../../../../core/capability/formula/evaluate.go#L747-L749)),
  on top of the steps the body itself charges while it runs.
- **One depth level per application.** `apply` evaluates the body at `depth+1`
  ([`evaluate.go:757`](../../../../core/capability/formula/evaluate.go#L757)),
  and `eval` rejects any node once `depth` exceeds `MaxDepth`
  ([`evaluate.go:100-102`](../../../../core/capability/formula/evaluate.go#L100-L102)).
  Unbounded recursion therefore terminates with `limit_exceeded` rather than
  exhausting the call stack or running forever — it fails against whichever of
  `MaxSteps` or `MaxDepth` is reached first.
- **Parse-time bounds are unchanged.** A `FUNCTION`/`LAMBDA` definition and an
  apply's argument list are ordinary AST nodes, so they count against
  `MaxNodes` and parse `MaxDepth` like any other expression, and a function's
  parameter list is bounded by `MaxFields`
  ([`syntax.go:586-609`](../../../../core/capability/formula/syntax.go#L586-L609)).
- **A produced function value is admitted like any other value** — inspected
  and bounded against `MaxOutputBytes` by its source text length
  ([`evaluate.go:971-975`](../../../../core/capability/formula/evaluate.go#L971-L975)).

No new limit field was added to `Limits`; see
[the deterministic limits table in the formula README](README.md#deterministic-limits).

## Not supported

There are no named/keyword arguments, default parameter values, variadic
function definitions, mutual-recursion helpers beyond late-bound name lookup,
or a way to serialize a function's captured scope. A function value cannot be
compared for ordering (`<`, `<=`, `>`, `>=` are number-only) and is not a valid
operand for arithmetic.
