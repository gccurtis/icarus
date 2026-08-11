# function.go

`function.go` defines the immutable payload behind a `KindFunction` value: a
user-defined `FUNCTION`/`LAMBDA` closure. A function value carries its ordered
parameter names, its unevaluated body, and the exact source text used for
display and equality — never a serialized form (see `value.go`'s `MarshalJSON`
and `UnmarshalJSON`, which emit a display-only descriptor and reject decoding).

## Code breakdown

### Package declaration

```go
package formula

```

This file belongs to the pure `formula` package and supplies the function
value payload consumed by `value.go`, `syntax.go`, and `evaluate.go`.

### The functionValue payload

```go
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
```

`functionValue` is the unexported payload a `KindFunction` `Value` points at.
`params` holds the ordered parameter names, `body` is the unevaluated AST node
applying the function evaluates, and `source` is the exact source span — captured
by the parser at parse time (`syntax.go`'s `parseFunction` sets it as `Node.Source`
on the `NodeFunction` node; `evaluate.go`'s `makeFunction` copies it onto the
payload) — used for `String()` and for `Equal` (two functions are equal only if
their parameter lists and source text match exactly — `captured` is deliberately
excluded from that comparison). Capturing the source at parse time, rather than
slicing it out of the evaluator's current source string at evaluation time, is
what keeps a nested closure's source correct: an inner `NodeFunction`'s span is
only ever valid against the source it was parsed from, but the *evaluator* that
turns it into a value may be running under a different top-level source string
(for example when a stored function is resolved and applied from a different
expression), so slicing at evaluation time would index the wrong string. The
struct is immutable once built, matching every other Formula value payload.
`captured` points at the `scope` (defined in `evaluate.go`) that was active when
the function was defined — nil for a function with no free identifiers or one
built with no enclosing scope. This is what makes closures lexical: `apply` (in
`evaluate.go`) chains a fresh parameter frame onto `captured` rather than onto
whatever scope happens to be active at the call site, so a function's free
identifiers resolve against where it was written, not where it is invoked.

A function value has no table payload, so `Value.Shape()` reports the scalar 1×1
default that every other scalar kind falls back to when there is no table
carrier — no dedicated constant is needed to document it.
