# Supported formulas (`formula/v1`)

This is the complete user-language catalog for the current implementation. If
a syntax form, operator, function, or alias is not listed here, `formula/v1`
does not support it.

The grammar is implemented in
[`syntax.go`](../../../../core/capability/formula/syntax.go), operators in
[`evaluate.go`](../../../../core/capability/formula/evaluate.go), and built-ins
in [`functions.go`](../../../../core/capability/formula/functions.go). The
parser and evaluator tests are
[`syntax_test.go`](../../../../core/capability/formula/syntax_test.go) and
[`evaluate_test.go`](../../../../core/capability/formula/evaluate_test.go).

## Lexical forms

| Form | Examples | Notes |
|---|---|---|
| number | `12`, `12.5`, `1e3`, `2.5E-2` | unsigned base-10 source form, preflighted against `MaxNumberBits`; unary `+`/`-` supply signs |
| text | `"hello"`, `"line\nfeed"` | double-quoted, escaped, valid UTF-8 text |
| logic | `true`, `false` | ASCII case-insensitive keywords |
| null | `null` | ASCII case-insensitive keyword |
| identifier | `score`, `_input2` | ASCII letter or `_`, then ASCII letters, digits, or `_` |
| whitespace | space, tab, CR, LF | ignored between tokens; there is no comment syntax |

Identifiers used as bindings and fields are case-sensitive. Function names are
ASCII case-insensitive, so `sum`, `SUM`, and `Sum` name the same built-in.
Literal keywords are reserved in every ASCII case and cannot be read as binding
names.

More precisely, a source number is digits followed by an optional decimal point
and zero or more digits, then an optional `e`/`E`, sign, and required exponent
digits. It therefore accepts `1.` but not `.5`; write the latter as `0.5`.
Text escaping follows Go's double-quoted string rules, and the decoded result
must be valid UTF-8.

## Grammar

In compact EBNF, the implemented grammar is:

```text
expression     = logical-or ;
logical-or     = logical-and, { "||", logical-and } ;
logical-and    = comparison, { "&&", comparison } ;
comparison     = additive, [ ("=" | "!=" | "<" | "<=" | ">" | ">="), additive ] ;
additive       = multiplicative, { ("+" | "-"), multiplicative } ;
multiplicative = unary, { ("*" | "/" | "%"), unary } ;
unary          = ("+" | "-" | "!"), unary | power ;
power          = postfix, [ "^", unary ] ;
postfix        = primary, {
                   ".", identifier
                 | ".", "{", selection, "}"
                 | "[", expression, "]"
                 | "[", [ expression ], ":", [ expression ], "]"
                 | "!" | "?"
                 | "(", [ expression, { ",", expression } ], ")"   (* apply *)
                 } ;
selection      = projection | query ;
projection     = field-name, { ",", field-name } ;
query          = pred-comma ;
pred-comma     = pred-or,  { ",",  pred-or } ;   (* comma = AND, loosest *)
pred-or        = pred-xor, { "||", pred-xor } ;
pred-xor       = pred-and, { "^",  pred-and } ;  (* ^ is XOR at this level *)
pred-and       = pred-not, { "&&", pred-not } ;
pred-not       = "!", pred-not | pred-primary ;
pred-primary   = "(", query, ")" | pred-compare ;
pred-compare   = field-name, ("=" | "!=" | "<" | "<=" | ">" | ">="), additive ;
field-name     = identifier ;
primary        = number | text | "true" | "false" | "null"
               | identifier
               | identifier, "(", [ expression, { ",", expression } ], ")"
               | ("FUNCTION" | "LAMBDA"), "(", { identifier, "," }, expression, ")"
               | "(", expression, ")"
               | "[", [ expression, { ",", expression } ], "]"
               | "{", [ record-field, { ",", record-field } ], "}" ;
record-field   = identifier, ":", expression ;
```

Empty calls, lists, and records are valid; trailing commas are not. An empty
index `value[]` is invalid, while the full slice `value[:]` is valid. `identifier,
"(", ...)"` names either a built-in or a resolved function value (see
[User-defined functions](functions.md)); the postfix `(args)` apply form calls
any other postfix result — a group, a chained call, a field access, or an
inline `FUNCTION`/`LAMBDA` — and any primary/call/apply result can be further
followed by field, index, slice, dot-curly selection, or strict/optional
promotion operations. A dot-curly
selection is a projection (a list of bare field names) or a query (a boolean
predicate); a leading `(`/`!`, or a field name followed by a comparison operator,
marks a query. Inside a query, comparison leaves combine with `,`/`&&` (AND),
`||` (OR), `^` (XOR), `!` (NOT), and parentheses — loosest to tightest: `,` `||`
`^` `&&` `!`. Because a leaf's right-hand side is an `additive` expression, XOR
operands must be parenthesized (`(a) ^ (b)`), and `^` inside a right-hand side is
power.

The public AST distinguishes literal, name, group, unary, binary, call, list,
record, field, index, slice, projection, query (with a boolean predicate tree of
pred_and/pred_or/pred_xor/pred_not/pred_compare nodes), promote, optional,
function, and apply
nodes. Its spans
are half-open UTF-8 byte ranges.

## Precedence and associativity

From tightest to loosest:

| Level | Forms | Associativity |
|---:|---|---|
| 1 | primary forms, then `.field`, `[index]`, `[start:end]`, `.{...}`, postfix `!`/`?`, postfix `(args)` apply | postfix left-to-right |
| 2 | `^` | right |
| 3 | prefix `+`, prefix `-`, prefix `!` | right/nested |
| 4 | `*`, `/`, `%` | left |
| 5 | `+`, `-` | left |
| 6 | `=`, `!=`, `<`, `<=`, `>`, `>=` | non-chaining |
| 7 | `&&` | left, short-circuiting |
| 8 | `||` | left, short-circuiting |

Power binds tighter than a leading sign, while a signed exponent is allowed:

| Formula | Grouping and result |
|---|---|
| `-2 ^ 2` | `-(2 ^ 2)` = `-4` |
| `2 ^ -3` | `2 ^ (-3)` = `0.125` |
| `2 ^ 3 ^ 2` | `2 ^ (3 ^ 2)` = `512` |

Parentheses create an explicit group and override precedence.

## Operators

Arithmetic operators require number operands and return an exact number. There
is no implicit conversion from text or logic.

| Operator | Arity | Behavior |
|---|---:|---|
| `+` | prefix | numeric identity |
| `-` | prefix | numeric negation |
| `!` | prefix | logical negation; operand must be logic |
| `+` | infix | exact addition |
| `-` | infix | exact subtraction |
| `*` | infix | exact multiplication |
| `/` | infix | exact division; zero divisor is `divide_by_zero` |
| `%` | infix | truncating integer remainder whose sign follows the dividend; both operands must be integers and divisor non-zero |
| `^` | infix | exact integer power; exponent must be an `int64` integer within `MaxPower`; negative exponent inverts the result |
| `=` | infix | deep typed equality |
| `!=` | infix | negated deep typed equality |
| `<`, `<=`, `>`, `>=` | infix | exact numeric ordering; an ordering involving `null` is `false` |
| `&&` | infix | logical AND; a false left operand skips the right operand |
| `\|\|` | infix | logical OR; a true left operand skips the right operand |

An operation that would exceed `MaxNumberBits` is `limit_exceeded` rather than
an approximate result. Zero raised to a negative power is `divide_by_zero`,
while `0 ^ 0` evaluates to `1`. Equality works across every value kind without
coercion. Ordering is number-only unless either operand is `null`, in which
case it returns `false`; another non-number combination is `type_error`.
Logical operators require logic operands. There are no assignment,
concatenation, or pipe operators.

## Conditional function

`IF(condition, when-true, when-false)` requires exactly three arguments and a
logic condition. It is lazy: only the selected result expression is evaluated.
This makes guarded formulas meaningful, for example
`IF(denominator = 0, null, numerator / denominator)`. As with `&&` and `||`, an
error in a skipped branch does not occur.

## Aggregate functions

`SUM`, `PRODUCT`, `MIN`, `MAX`, and `AVG`/`AVERAGE` recursively traverse list,
record, and table arguments in row/field order. A `null` leaf is **skipped** — the
same treatment `COUNT` gives it, so these aggregates ignore missing cells the way a
spreadsheet ignores blanks (`SUM([1, null, 3])` is `4`, `AVG([1, null, 3])` is `2`).
Every other leaf must be a number; text and logic values still fail with
`type_error`. They can mix scalar and structured arguments. `MIN`/`MAX`/`AVG` over a
collection that yields no numbers at all (e.g. all-`null`) still report that they need
at least one number.

| Function | Arity | Result |
|---|---:|---|
| `SUM(values...)` | 0+ | exact sum; `SUM()` is `0` |
| `PRODUCT(values...)` | 0+ | exact product; `PRODUCT()` is `1` |
| `MIN(values...)` | 1+ | smallest number; evaluated arguments must contain at least one numeric leaf |
| `MAX(values...)` | 1+ | largest number; evaluated arguments must contain at least one numeric leaf |
| `AVG(values...)` | 1+ | exact arithmetic mean; evaluated arguments must contain at least one numeric leaf |
| `AVERAGE(values...)` | alias of `AVG` | exact arithmetic mean |

`COUNT(values...)` has different leaf semantics: it recursively counts every
non-null scalar leaf regardless of kind, counts null as zero, and returns an
exact integer. `COUNT()` is `0`.

Examples:

| Formula | Result |
|---|---:|
| `SUM([1, 2, 3])` | `6` |
| `SUM([1, null, 3])` | `4` |
| `PRODUCT(2, [3, 4])` | `24` |
| `AVG([1, 2, 4])` | `7/3` |
| `AVG([1, null, 3])` | `2` |
| `COUNT([1, null, "x"])` | `2` |

## Scalar arithmetic functions

| Function | Arity | Behavior |
|---|---:|---|
| `ABS(number)` | 1 | absolute value |
| `MOD(left, right)` | 2 | same integer-remainder rules as `%` |
| `POWER(base, exponent)` | 2 | same integer-power rules as `^` |
| `POW(base, exponent)` | alias of `POWER` | exact integer power |
| `ROUND(number)` | 1 | rounds to an integer; halfway cases go away from zero |
| `ROUND(number, places)` | 2 | rounds to decimal places; `places` is an integer within `MaxRoundPlaces`, and may be negative |
| `FLOOR(number)` | 1 | greatest integer less than or equal to the number |
| `CEIL(number)` | 1 | least integer greater than or equal to the number |
| `CEILING(number)` | alias of `CEIL` | least integer greater than or equal to the number |

Examples:

| Formula | Result |
|---|---:|
| `ROUND(12.345, 2)` | `12.35` |
| `ROUND(-2.5)` | `-3` |
| `ROUND(125, -1)` | `130` |
| `FLOOR(-1.2)` | `-2` |
| `CEIL(-1.2)` | `-1` |
| `POWER(2, -3)` | `0.125` |

## Table functions and postfix queries

| Function | Arity | Behavior |
|---|---:|---|
| `TABLE(records...)` | 0+ | builds a table from records; zero records gives an empty table |
| `TABLE(record-list)` | 1 | builds a table from one list of records |
| `ROWS(value)` | 1 | returns the value's row dimension |
| `COLUMNS(value)` | 1 | returns the value's field dimension |

Projection and querying are postfix syntax, not functions:

| Syntax | Target | Result |
|---|---|---|
| `value.{field, ...}` | record or table | same kind, with selected/reordered fields |
| `value.{predicate}` | record or table | table retaining rows for which the boolean predicate holds |
| `value!` | record or exactly-one-row table | record |
| `value?` | record or zero/one-row table | record, or `null` for zero rows |

Query comparison leaves accept exactly `=`, `!=`, `<`, `<=`, `>`, and `>=`, and
combine with `,`/`&&` (AND), `||` (OR), `^` (XOR), `!` (NOT), and parentheses. Inside
a query an identifier resolves field-first (the row's column if one exists, else a
binding), so both sides of a leaf may name columns; comparisons are evaluated per
row. `TABLE` schema alignment,
selection edge cases, field access, indexes, slices, and promotion are specified
in [Querying](querying.md). `SELECT(...)` and `WHERE(...)` are not built-ins.

## User-defined functions: `FUNCTION`/`LAMBDA` and apply

`FUNCTION`/`LAMBDA` produce a first-class `function` value, and any postfix
expression can be applied with `(args...)`:

```text
FUNCTION(x, x * 2)(21)
LAMBDA(a, b, a + b)(2, 3)
(FUNCTION(x, x))(5)
double(21)
```

| Form | Result |
|---|---|
| `FUNCTION(param, ..., body)` / `LAMBDA(param, ..., body)` | a `function` value; zero parameters are allowed, at least the body argument is required |
| `target(args...)` | applies `target`; arity must match the function's parameter count (`wrong_arity` otherwise) |

The `function` kind is a scalar alongside `null`/`number`/`text`/`logic`/
`list`/`record`/`table`: shape `1 × 1`, structurally-equal by parameter names
and source text, rendered as its source text by `String()`, and encoded
display-only in JSON (`kind`, `shape`, `params`, `source` — decoding a
`function` kind is rejected). Full details, dispatch order for `name(args)`
(built-in → resolved function value → `unknown_function`), lexical closures,
and the safety story are in [User-defined functions](functions.md).

## Names and bindings

A bare non-keyword identifier reads the exact key from `Bindings`; a missing
key is `unknown_identifier`. Bindings are request-scoped values, not mutable
variables. There is no assignment, local declaration, or access to environment
variables and persisted objects. A function's parameters and any enclosing
function's parameters form a lexical scope layered in front of `Bindings`; see
[User-defined functions](functions.md#lexical-closures-with-late-binding).

Built-ins form a closed registry checked first; a built-in's name and arity are
both validated from the call before any argument evaluates. A call name that
is not a built-in is instead resolved as a user-defined function value — from
function scope, the current query row, or `Bindings` — and that resolution
also happens before any argument evaluates, so an unresolvable name is
`unknown_function` without ever evaluating its arguments (`NOPE(1 / 0)` is
`unknown_function`, not `divide_by_zero`). A resolved function's arity,
however, is enforced only once it is applied, after its arguments have already
run — so `wrong_arity` for a user-defined function can follow argument
evaluation, unlike a built-in's arity check. Once past these checks, arguments
are eager except for `IF`, which evaluates only its condition and selected
branch.

## Not supported in `formula/v1`

Notable omissions include keyword spellings `AND`/`OR`/`NOT`, text operations,
date/time operations, mutation, assignment, named/default/variadic function
arguments, ranges, computed projections, arbitrary row-scoped predicates, table
joins/grouping/sorts, and external data lookup. These omissions are explicit
current boundaries, not alternate undocumented spellings.
