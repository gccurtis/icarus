# 0017 — Formula core: exact expressions and table-shaped data

This increment adds the first working Formula capability: a pure, headless
`formula/v1` parser and evaluator over immutable typed values. It supports
literals, parentheses, exact arithmetic, comparisons, short-circuit logic,
lazy conditionals, lists, records, tables, row/field navigation, slicing,
dot-curly projection and querying, exact-one promotion, and a focused arithmetic
function library. It has no route, persistence, provider, or document
integration; a Go
caller supplies the complete expression and request-scoped bindings and receives
one typed value or structured error.

The historical Formula/Data material under `docs/reference/` informed the
boundary—especially purity, versioning, exact numbers, typed values, and explicit
limits—but was not treated as an implementation checklist. Project-scoped names,
governed persisted data objects, lineage, catalog projections, analytic compute,
and consumer recalculation remain future increments.

## Design decisions

### Formula is a value kernel, not a data service

```text
source + exact bindings + language version + limits -> Value | FormulaError
```

Evaluation has no storage, network, clock, randomness, model call, Knowledge
lookup, or cross-capability callback. This keeps a formula reproducible and makes
the current increment directly exercisable without scaffolding handlers,
repositories, or jobs ahead of need.

### Structured values share a table-shaped carrier

```text
scalar = 1 field x 1 row
list   = 1 field x N rows
record = N fields x 1 row
table  = N fields x M rows
```

Scalars stay strongly typed rather than being physically stored as tables.
Lists, records, and tables share one immutable rectangular carrier, so field and
row operations compose without inventing three unrelated collection models.
This increment intentionally permits heterogeneous cells and nested structured
values; it does not yet define a persisted schema or homogeneous column type.

### Exactness and bounds are both language semantics

Numbers are reduced `math/big.Rat` values, so `0.1 + 0.2` is exactly `0.3` and
`1 / 3` remains `1/3`. Exact arithmetic can otherwise grow without bound, so
Formula preflights numeric literals, checks every admitted and produced rational,
weights work by operand magnitude, and rejects oversized powers before allocating
their result. Configured limits may tighten the production defaults but cannot
raise those hard ceilings.

### Querying is explicit, ordered, and in memory

Indexes are one-based, negative indexes count from the end, and slices are
half-open with omitted and negative bounds. Tables retain field and row order.
`TABLE` and postfix selection operations materialize bounded values immediately.
`target.{field, ...}` projects columns, `target.{field op value, ...}` retains
rows matching ANDed conditions, and postfix `!` asserts and promotes exactly one
row. There is no lazy query plan, persisted index, arbitrary row-scoped
predicate, join, sort, or grouping engine hidden behind this first API.

## `core/capability/formula/formula.go`

### Establish the versioned public boundary and stable failures

```go
const LanguageVersion = "formula/v1"

type FormulaError struct {
	Kind    ErrorKind `json:"kind"`
	Message string    `json:"message"`
	Span    Span      `json:"span"`
	Limit   string    `json:"limit,omitempty"`
}
```

The language version is explicit even before expressions are persisted, so a
future stored AST cannot silently acquire new semantics. Error kinds are stable
machine-readable categories; messages explain an occurrence but are not the
compatibility contract. Source spans are half-open UTF-8 byte ranges and limit
errors also name the counter crossed.

### Make resource ceilings deterministic and non-escalatable

```go
var defaultLimits = Limits{
	MaxSourceBytes: 16 * 1024,
	MaxTokens:      4096,
	MaxNodes:       4096,
	MaxDepth:       64,
	MaxSteps:       100_000,
	MaxFields:      256,
	MaxRows:        10_000,
	MaxCells:       100_000,
	MaxOutputBytes: 1 << 20,
	MaxNumberBits:  1 << 20,
	MaxPower:       1024,
	MaxRoundPlaces: 100,
}
```

The limits cover source, syntax, recursion, work, table dimensions, rendered
size, rational magnitude, exponentiation, and decimal rounding. `Service` holds
only the effective immutable limits and is safe for concurrent use. Positive
options use `min(default, requested)`: callers can make an evaluation cheaper,
but cannot use this constructor to disable the production safety envelope.

## `core/capability/formula/formula.go.md`

### Add the verbatim companion for the package boundary

```go
// Package formula implements Taurus's pure, deterministic expression language.
// It owns parsing, typed in-memory values, evaluation, and bounded table-shaped
// queries. It deliberately performs no storage, network, clock, random, model,
// or cross-capability work.
package formula
```

The companion reproduces every byte of `formula.go` in source order and explains
the version, error, limit, option, and service blocks. It is current-state
documentation; this record retains why those boundaries were introduced.

## `core/capability/formula/syntax.go`

### Add a public, versioned AST with byte spans

```go
type Expression struct {
	LanguageVersion string `json:"languageVersion"`
	Source          string `json:"source"`
	Root            *Node  `json:"root"`
}
```

The lexer and recursive-descent parser preserve literals, names, groups, unary
and binary operators, calls, lists, records, fields, indexes, slices,
projections, queries, and promotion as distinct JSON-friendly nodes. Keeping
the original source and precise spans
allows safe diagnostics now and gives later consumers a versioned syntax object
without requiring persistence in this increment.

### Encode expression precedence and collection postfix syntax

```text
logical-or     = logical-and, { "||", logical-and } ;
logical-and    = comparison, { "&&", comparison } ;
comparison     = additive, [ comparison-operator, additive ] ;
additive       = multiplicative, { ("+" | "-"), multiplicative } ;
multiplicative = unary, { ("*" | "/" | "%"), unary } ;
unary          = ("+" | "-" | "!"), unary | power ;
power          = postfix, [ "^", unary ] ;
postfix        = primary, { "." field | ".{" selection "}"
                           | "[" index-or-slice "]" | "!" } ;
```

Power is right-associative and binds more tightly than a leading sign, so
`-2 ^ 2` is `-4`, `2 ^ -3` is valid, and `2 ^ 3 ^ 2` is `512`. Logical AND/OR
sit above comparisons and short-circuit at evaluation. Postfix operations chain
left to right, enabling compositions such as
`people.{score >= cutoff}.{name}!.name`.

Dot-curly syntax is statically distinguished by the first entry: a field name
starts a projection, while a field followed by `=`, `!=`, `<`, `<=`, `>`, or
`>=` starts a condition query. Conditions are comma-separated AND clauses and
their right-hand expressions are evaluated once in ordinary binding scope,
before row scanning.

### Validate completed and caller-supplied trees

```go
func validateExpression(expression *Expression, limits Limits) *FormulaError {
	if expression == nil || expression.Root == nil {
		return errorAt(ErrorParse, Span{}, "expression is empty")
	}
	if expression.LanguageVersion != LanguageVersion {
		return errorAt(ErrorUnsupportedVersion, expression.Root.Span, "unsupported Formula language version %q", expression.LanguageVersion)
	}
```

`Parse` validates the finished tree's real depth and node count, including
left-associated and postfix chains that the iterative parser can build without
recursive calls. `EvaluateExpression` repeats structural validation before any
argument slice is allocated, so a deserialized or hand-built public AST cannot
bypass source, span, child, depth, or node limits. Because validation itself is
iterative and node-bounded, even a cyclic caller-built tree terminates with a
typed `ast_nodes` limit failure.

### Preflight literals before expensive construction

```go
	case tokenNumber:
		value, numberErr := parseNumberValue(tok.lit, p.limits.MaxNumberBits, tok.span)
		if numberErr != nil {
			return nil, numberErr
		}
		return p.node(Node{Type: NodeLiteral, Span: tok.span, Value: &value})
	case tokenText:
		value, textErr := TextValue(tok.lit)
		if textErr != nil {
			return nil, errorAt(ErrorParse, tok.span, "text literal is not valid UTF-8")
		}
```

Number spelling and magnitude are checked before `big.Rat` receives an extreme
decimal exponent. Text escapes must decode to valid UTF-8. These checks close
resource and round-trip gaps at the earliest boundary rather than hoping the
final result still contains the problematic literal.

## `core/capability/formula/syntax.go.md`

### Add the verbatim lexer/parser companion

```go
// NodeType identifies one public AST node shape.
type NodeType string
```

The companion follows the source from public AST types through tokenization,
tree validation, precedence parsing, collection grammar, and parser helpers. Its
code blocks concatenate to the exact current `syntax.go`.

## `core/capability/formula/syntax_test.go`

### Round-trip the public expression form through JSON

```go
	data, err := json.Marshal(expression)
	if err != nil {
		t.Fatal(err)
	}
	var decoded formula.Expression
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatal(err)
	}
	value, err := formula.NewService().EvaluateExpression(&decoded, nil)
```

The test parses a complete expression, serializes the public tree, decodes it,
and evaluates the result. This proves that the exported AST is an actual wire
form rather than merely a set of JSON tags that compile, while the evaluator's
structural validation remains the trust boundary for decoded trees.

### Prove grammar, precedence, spans, and hostile-depth behavior

```go
	service = formula.New(formula.Options{Limits: formula.Limits{MaxDepth: 1}})
	_, err = service.Parse("1 + 2")
	if !errors.As(err, &formulaErr) || formulaErr.Kind != formula.ErrorLimitExceeded || formulaErr.Limit != "parse_depth" {
		t.Fatalf("AST depth error = %#v", err)
	}
```

The parser tests cover every literal/collection/postfix node family, arithmetic
precedence and associativity, stable byte spans, token limits, actual AST-depth
limits, duplicate record fields, malformed collections and slices, unterminated
text, invalid UTF-8 escapes, and the catalogued rejection of leading-dot `.5`.

## `core/capability/formula/value.go`

### Define the typed value algebra and common rectangular carrier

```go
const (
	KindNull   Kind = "null"
	KindNumber Kind = "number"
	KindText   Kind = "text"
	KindLogic  Kind = "logic"
	KindList   Kind = "list"
	KindRecord Kind = "record"
	KindTable  Kind = "table"
)
```

`Shape` gives every value field/row dimensions, while `Table` physically carries
only lists, records, and tables. Field names are ordered, unique, non-empty valid
UTF-8; every row is rectangular. Constructors and accessors deep-copy nested
values and exact-number pointers, preserving the public immutability promise.

### Keep numeric construction exact and bounded

```go
func NumberValue(source string) (Value, error) {
	value, err := parseNumberValue(source, DefaultLimits().MaxNumberBits, Span{})
	if err != nil {
		return Value{}, err
	}
	return value, nil
}
```

Formula syntax accepts base-10 integer, decimal, and exponent forms; the public
constructor additionally accepts an exact rational spelling such as `1/3` for
wire round-trips. Decimal digit/exponent preflight rejects values outside the
hard rational bound before allocation. Zero with an enormous exponent safely
normalizes to zero because its magnitude never grows.

### Require valid UTF-8 at value boundaries

```go
func TextValue(text string) (Value, error) {
	if !utf8.ValidString(text) {
		return Value{}, errorAt(ErrorType, Span{}, "text is not valid UTF-8")
	}
	return Value{kind: KindText, text: text}, nil
}
```

Go strings can contain arbitrary bytes while JSON text cannot preserve invalid
UTF-8. Rejecting invalid text and field names makes equality, string rendering,
and JSON round-trips describe the same value instead of silently substituting
replacement characters.

### Serialize exact typed values deterministically

```go
type wireValue struct {
	Kind   Kind      `json:"kind"`
	Shape  Shape     `json:"shape"`
	Number *string   `json:"number,omitempty"`
	Text   *string   `json:"text,omitempty"`
	Logic  *bool     `json:"logic,omitempty"`
	Fields []string  `json:"fields,omitempty"`
	Rows   [][]Value `json:"rows,omitempty"`
}
```

Numbers travel as canonical strings, so repeating rationals never round through
JSON floating point. Decoding requires kind and shape, permits only the payload
fields appropriate to that kind, rebuilds table invariants, rejects trailing
data, and validates list/record special shapes. This is a value wire form only;
no endpoint or persistence schema consumes it yet.

### Format large terminating rationals without linear factor peeling

```go
	twos := int(denominator.TrailingZeroBits())
	denominator.Rsh(denominator, uint(twos))
	fives := factorCount(denominator, 5)
```

Terminating values render as trimmed decimals and other rationals as reduced
fractions. Powers of two are counted directly and powers of five by bounded
binary search, avoiding one large-integer division per decimal place for values
such as `1e-30000`.

## `core/capability/formula/value.go.md`

### Add the verbatim value-model companion

```go
// Value is one immutable Formula value. Structured values carry the common
// table-shaped representation described by Shape; scalar payloads stay typed
// and cannot be silently coerced.
type Value struct {
```

The companion documents the current carrier, constructors, cloning/access,
equality, rendering, numeric preflight/formatting, and JSON blocks in source
order while reproducing `value.go` exactly.

## `core/capability/formula/value_test.go`

### Prove shape, copying, exact wire data, and boundary validation

```go
func TestValueConstructorsRejectInvalidUTF8(t *testing.T) {
	invalid := string([]byte{0xff})
	if _, err := formula.TextValue(invalid); err == nil {
		t.Error("TextValue accepted invalid UTF-8")
	}
	if _, err := formula.NewTable([]string{invalid}, nil); err == nil {
		t.Error("NewTable accepted an invalid UTF-8 field")
	}
}
```

Tests cover canonical exact-number spellings, list/record/table shapes, field
projection, deep-copy isolation, typed JSON round-trips, false/missing shapes,
irrelevant payload fields, trailing data, invalid UTF-8, huge-number preflight,
large zero exponents, and efficient canonical formatting of a 30,000-place
terminating decimal.

## `core/capability/formula/evaluate.go`

### Evaluate only validated, exact request inputs

```go
func (s *Service) EvaluateExpression(expression *Expression, bindings Bindings) (Value, error) {
	if err := validateExpression(expression, s.Limits()); err != nil {
		return Value{}, err
	}
	evaluator := evaluator{limits: s.Limits(), bindings: bindings}
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

Bindings are caller-owned immutable request inputs and are read directly rather
than copied wholesale; only referenced values are admitted and cloned. Every
literal, constructed collection, and call result is admitted even when a later
operation discards it. The final value is admitted again and deep-copied across
the capability boundary.

### Implement exact arithmetic and preflight growth

```go
	if productExceeds(numeratorBits, abs, e.limits.MaxNumberBits) || productExceeds(denominatorBits, abs, e.limits.MaxNumberBits) {
		return Value{}, limitError(span, "number_bits")
	}
```

Unary `+`/`-` and infix `+`, `-`, `*`, `/`, `%`, and `^` require numbers and
never coerce. Divide/remainder by zero have their own stable error. Multiplication,
division, and power estimate result growth before allocating large integers;
every result is checked again afterward. Exponent magnitude and numeric work are
charged independently.

### Define rows, fields, indexes, and slices

```go
	if requested == 0 {
		return 0, errorAt(ErrorInvalidIndex, span, "collection indexes are one-based; zero is invalid")
	}
	position := requested - 1
	if requested < 0 {
		position = int64(length) + requested
	}
```

Text indexes route to exact field lookup. A bare identifier index on a record or
table is static field-name sugar; parentheses force evaluation of a bound
numeric index. Numeric list/table indexes are one-based, with negative positions
counted from the end; table indexing returns a record. Half-open list/table
slices accept omitted or negative boundaries,
clamp outside bounds, preserve target kind, and collapse reverse intervals to an
empty result.

### Evaluate comparisons, selection, and promotion as typed value operations

```text
SUM(people.{score >= cutoff, active = true}.{score}.score)
people.{id = wanted}!.name
```

Infix equality is deep and typed; numeric ordering is exact and treats an
ordering involving `null` as false. `&&` and `||` require logic operands and do
not evaluate an unnecessary right side. Projection preserves target kind, row
order, and requested field order. Querying always returns a table with the
source schema and matching row order, including when the input is one record.
Postfix `!` converts an exactly-one-row table to a record, leaves records as
records, and reports `cardinality_error` for zero or multiple rows.

### Admit value depth, dimensions, work, and rendered size

```go
		if shape.Fields > e.limits.MaxFields {
			return 0, limitError(span, "fields")
		}
		if shape.Rows > e.limits.MaxRows {
			return 0, limitError(span, "rows")
		}
		cells := shape.Fields * shape.Rows
		if cells > e.limits.MaxCells {
			return 0, limitError(span, "cells")
		}
```

Admission recursively checks nested values, counts zero-width table rows as
real work, validates list/record carrier invariants, and computes a conservative
bound for the human-readable result including table schema, repeated row fields,
delimiters, escaped text, and terminating decimals. This prevents an apparently
small AST from returning or processing an unbounded value.

## `core/capability/formula/evaluate.go.md`

### Add the verbatim evaluator companion

```go
// Evaluate parses and evaluates source with DefaultLimits.
func Evaluate(source string, bindings Bindings) (Value, error) {
	return NewService().Evaluate(source, bindings)
}
```

The companion explains the evaluator dispatch, exact-number operations,
navigation/slicing conventions, recursive value inspection, rendered-size
estimation, and deterministic charging in the same order as `evaluate.go`.

## `core/capability/formula/functions.go`

### Register a closed, case-insensitive built-in set

```go
	switch name {
	case "SUM":
		return e.sum(args, node.Span)
	case "PRODUCT":
		return e.product(args, node.Span)
	case "MIN":
		return e.minimum(args, node.Span)
	case "MAX":
		return e.maximum(args, node.Span)
	case "AVG", "AVERAGE":
		return e.average(args, node.Span)
```

The complete arithmetic/aggregate set is `SUM`, `PRODUCT`, `MIN`, `MAX`,
`AVG`/`AVERAGE`, `COUNT`, `ABS`, `MOD`, `POWER`/`POW`, `ROUND`, `FLOOR`, and
`CEIL`/`CEILING`. Function existence and arity are validated before arguments
run. Recognized valid calls then evaluate arguments eagerly except `IF`, which
evaluates only its condition and selected branch. This makes unknown-function
and wrong-arity diagnostics stable even when an argument would itself fail.

### Flatten structured numeric aggregates without coercion

```go
		if value.Kind() != KindList && value.Kind() != KindRecord && value.Kind() != KindTable {
			return errorAt(ErrorType, span, "expected number, got %s", value.Kind())
		}
```

Numeric aggregates recursively traverse lists, records, and tables in row/field
order and require every leaf to be numeric. `SUM()` is zero and `PRODUCT()` is
one; `MIN`, `MAX`, and averages require at least one argument and at least one
numeric leaf. `COUNT` instead counts every non-null scalar leaf.

### Add a lazy conditional and build ordered tables

```go
	if name == "IF" {
		condition, err := e.eval(node.Args[0], depth)
		if err != nil {
			return Value{}, err
		}
		logic, ok := condition.Logic()
		if !ok {
			return Value{}, errorAt(ErrorType, node.Args[0].Span, "IF condition must be logic, got %s", condition.Kind())
		}
		branch := node.Args[2]
		if logic {
			branch = node.Args[1]
		}
		return e.eval(branch, depth)
	}

	case "TABLE":
		return e.table(args, node.Span)
	case "ROWS":
		return e.rows(args, node.Span)
	case "COLUMNS":
		return e.columns(args, node.Span)
```

`TABLE` accepts records directly or one list of records. The first record fixes
field order and later rows are realigned only if their exact field set matches.
`ROWS`/`COLUMNS` inspect any value's shape. `IF` requires a logic condition and
is intentionally lazy, so an error in its unselected branch does not occur.
Projection and querying belong to the postfix grammar rather than the function
registry; the earlier `SELECT` and `WHERE` call spellings are deliberately
rejected as unknown functions.

## `core/capability/formula/functions.go.md`

### Add the verbatim built-in-library companion

```go
func (e *evaluator) evalCall(node *Node, depth int) (Value, *FormulaError) {
	name := upperASCII(node.Name)
	if err := validateCall(name, len(node.Args), node.Span); err != nil {
		return Value{}, err
	}
```

The companion separates dispatch/arity, lazy conditional evaluation,
aggregates, scalar arithmetic, table construction, dimensions, and argument
helpers while preserving the source bytes exactly.

## `core/capability/formula/evaluate_test.go`

### Exercise formulas through the public API

```go
	if got := evaluate(t, `SUM(people.{score >= 88}.score)`, bindings).String(); got != "180" {
		t.Errorf("query aggregate = %s; want 180", got)
	}
```

End-to-end tests prove exact arithmetic and precedence, including the catalogued
trailing-dot `1.` literal; bindings; field access; positive, negative, and sliced
row selection; all arithmetic functions; table schema alignment; empty-result
schema retention; dot-curly projection and condition querying; promotion
cardinality; and aggregate/query composition. Dedicated regressions prove that
`SELECT(...)` and `WHERE(...)` are outside the language surface.

### Regress every deterministic safety boundary

```go
		{"discarded text", formula.Limits{MaxOutputBytes: 3}, `ROWS(["four"])`, "output_bytes"},
		{"discarded cells", formula.Limits{MaxCells: 3}, "ROWS([1, 2, 3, 4])", "cells"},
		{"nested power", formula.Limits{}, "((10 ^ 1024) ^ 1024) ^ 1024", "number_bits"},
		{"terminating decimal output", formula.Limits{MaxOutputBytes: 100}, "1 / (2 ^ 200)", "output_bytes"},
		{"literal preflight", formula.Limits{}, "1e100000000", "number_bits"},
```

The safety tests cover every named limit, the hard-ceiling clamp on service
options, discarded intermediates, nested power growth, terminating-decimal size,
huge literal preflight, forged public ASTs, zero-width row work, and large table
schemas. The forged-tree regression includes a cyclic AST and proves it
terminates at `limit_exceeded/ast_nodes`. Error tests also prove that function
lookup/arity failures precede argument evaluation and that failures across the
tested public boundaries remain typed.

## `docs/architecture/capabilities/formula/README.md`

### Document the capability boundary and execution pipeline

```markdown
Formula is Taurus Omega's pure, deterministic expression capability. The
current increment is a **headless Go package**: it parses `formula/v1` source,
evaluates it against request-scoped typed bindings, and returns an immutable
typed value or a structured error.
```

The capability README explains ownership, purity, source layout, parse/evaluate
flow, structured errors, exact default limits, and the intentional absence of a
handler or persistence path. It points readers to the three focused companion
architecture pages instead of turning one overview into an exhaustive manual.

## `docs/architecture/capabilities/formula/data-model.md`

### Specify values, shapes, exact numbers, and the wire form

```markdown
| `list` | field `value`, N rows | `1 × N` | `[item, ...]` |
| `record` | N ordered fields, one row | `N × 1` | `{field: value, ...}` |
| `table` | N ordered fields, M rows | `N × M` | `TABLE(...)` or a Go binding |
```

The data-model page defines all seven value kinds, the common rectangular
carrier, construction/copying invariants, exact rational spelling, typed deep
equality, canonical JSON, UTF-8 policy, and currently absent value kinds. It
also makes explicit that this in-memory model is not the governed persisted Data
Object system described in older reference material.

## `docs/architecture/capabilities/formula/querying.md`

### Specify every current navigation and query rule

```mermaid
Table -->|".field or [\"field\"]"| Column["list<br/>1 field × M rows"]
Table -->|"[index]"| Row["record<br/>N fields × 1 row"]
Table -->|"[start:end]"| Rows["table<br/>N fields × selected rows"]
Row -->|".field or [\"field\"]"| Cell["cell value"]
Column -->|"[index]"| Item["item value"]
```

The querying page records exact field lookup, one-based/negative indexes,
half-open and clamped slices, `TABLE` schema alignment, dimensions, dot-curly
projection and condition queries, exact-one promotion, composability, errors,
ordinary-scope condition values, and empty-result schema retention. It closes
with the persisted-index, planner, join, grouping, sorting, mutation, and
arbitrary row-predicate features deliberately deferred.

## `docs/architecture/capabilities/formula/supported-formulas.md`

### Publish the complete `formula/v1` catalog

```text
operators: +  -  *  /  %  ^  =  !=  <  <=  >  >=  !  &&  ||
aggregates: SUM PRODUCT MIN MAX AVG AVERAGE COUNT
numeric: ABS MOD POWER POW ROUND FLOOR CEIL CEILING
conditional: IF
tables: TABLE ROWS COLUMNS
selection: .{field, ...}  .{field op expression, ...}  postfix !
```

This page is the closed current-language reference: lexical forms, EBNF,
precedence, operators, function arities/aliases, binding rules, examples, and
unsupported syntax. A spelling absent from this catalog is not an implicit
alternate Formula feature.

## `docs/architecture/README.md`

### Add Formula to the architecture documentation index

```markdown
| **[Formula](../architecture/capabilities/formula/README.md)** | The headless, deterministic `formula/v1` parser/evaluator — with an exact [data model](../architecture/capabilities/formula/data-model.md), [query semantics](../architecture/capabilities/formula/querying.md), and complete [formula catalog](../architecture/capabilities/formula/supported-formulas.md). |
```

The main index now exposes Formula beside the existing capability docs and
links directly to its detailed model/query/catalog pages.

## `docs/architecture/overview.md`

### Put Formula in the current repository map

```mermaid
c["access · document · formula<br/>intelligence · knowledge"]
```

The overview now counts five capability packages and describes Formula as a
headless deterministic parser/evaluator that currently needs neither a port nor
HTTP wiring. This keeps the working architecture, rather than the historical
target map, authoritative.

## Verification

### Automated checks

```text
gofmt -d core/capability/formula/*.go
go test -count=1 ./core/capability/formula
go test -race -count=1 ./core/capability/formula
go test -count=1 ./...
git diff --check
```

The formatting diff was empty, all Formula tests passed normally and under the
race detector, the full repository test suite passed, and the diff has no
whitespace errors. Formula is pure and makes no provider call, so this increment
needs no paid live-provider suite.

## Completion boundary

Formula now has a usable, documented core for exact scalar and bounded
table-shaped computation. The increment stops before HTTP exposure, durable
expressions, names/references, dependency extraction, cycle/recalculation state,
Document formula atoms, persisted data objects and schemas, catalog/lineage,
analytic compute, text/date functions, arbitrary row predicates, and richer
relational operations. Those should arrive as independently exercisable
increments rather than being scaffolded into this one.

## Optional postfix promotion follow-up

The strict `!` promotion remains an exactly-one-row assertion. The companion `?`
operator is tolerant of an empty query: it returns `null` for zero rows, promotes
one row to a record, and still reports `cardinality_error` for multiple rows.

## Follow-up — numeric aggregates skip null

### `core/capability/formula/functions.go`

`collectNumbers` now skips a `null` leaf instead of raising `type_error` on it, so
`SUM`/`PRODUCT`/`MIN`/`MAX`/`AVG` ignore missing cells the way `COUNT` already did
(`countValue` returns 0 for `KindNull`) and the way a spreadsheet ignores blanks —
`SUM([1, null, 3])` is `4`, `AVG([1, null, 3])` is `2`.

**Why:** the original "every leaf must be a number, null included" rule was an
asymmetry — `COUNT` treated null as an absent value while the arithmetic aggregates
treated it as a type error — that surprised spreadsheet-shaped use and made a column
with any blank cell un-summable. **What stays the same:** text and logic leaves are
still `type_error` (only null is "missing", not "any non-number"), the skipped visit
is still charged a step so an all-null collection is bounded, and `MIN`/`MAX`/`AVG`
over a collection that yields no numbers still report that they need at least one
number. Covered by `TestAggregatesSkipNull`; `supported-formulas.md` and the
`functions.go.md` companion updated to match.
