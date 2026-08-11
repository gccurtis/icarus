# 0020 — Formula field-first query resolution (field-to-field comparisons)

Inside a query `.{...}`, a bare identifier now resolves **field-first**: it is the
current row's column if one of that name exists, and otherwise a binding — the SQL
convention. This lets a comparison name two columns of the same row
(`projects.{spent > budget}`) with no sigil, closing the "field-to-field" gap left
open by record 0019.

Design decisions:

- **Field-first, both sides.** Left and right identifiers of a leaf resolve the same
  way, through one helper (`resolveIdentifier`), which also backs ordinary
  `NodeName` evaluation (outside a query it is a plain binding lookup).
- **Column shadows a like-named binding** inside the query (column wins) — standard
  SQL precedence. There is deliberately no escape hatch to force the binding.
- **Per-row right-hand sides.** Because a right-hand side may reference a column, it
  is evaluated per row rather than once; the step budget keeps this bounded.
- **Not built:** the pipe/"division" grouping operator (a partition-and-reduce that
  also needs a per-group function layer) — still a future feature.

## `core/capability/formula/evaluate.go`

### A row scope on the evaluator

```go
// evaluator gains: rowScope *queryRowScope
type queryRowScope struct { index map[string]int; row []Value }
```

**What / goal / why:** an optional pointer to the query row currently being matched.
It is the whole mechanism for field-first resolution — set only while a query scans,
nil everywhere else, so non-query evaluation is unchanged and still deterministic.

### resolveIdentifier — one field-first resolution path

```go
func (e *evaluator) resolveIdentifier(name string, span Span, depth int) (Value, *FormulaError)
// NodeName now simply calls resolveIdentifier.
```

**What / goal / why:** when `rowScope` is set, an identifier reads the row's column
before any binding; otherwise it is a binding. Routing both the `NodeName` case and
a query leaf's left field through this one function keeps the "field first, then
binding" rule in a single place — important because it is the identifier-resolution
seam.

### evalQuery / matchPredicate — per-row, field-first

```go
// evalQuery points e.rowScope at each row (saving/restoring for nested queries);
// matchPredicate walks the predicate against the current row, resolving the left
// field-first and evaluating the right expression per row.
```

**What / goal / why:** replaces the previous "resolve once, then scan" evaluator
(`resolvedPredicate`/`resolvePredicate` removed). A leaf now resolves its left field
and evaluates its right expression against the live row, so `spent > budget` compares
two columns. `&&`/`||` still short-circuit; each comparison charges a step; the tree
depth remains bounded by `validateExpression`.

**Error-semantics change:** a query identifier that is neither a column nor a binding
is now `unknown_identifier` (it used to be `unknown_field` when the left had to be a
column). Reflected in `TestEvaluateStableErrorsAndLimits`.

## Tests & docs

`TestQueryFieldToFieldResolution` covers field-vs-field (`spent > budget`), a
field-vs-binding fallback, arithmetic over a field on the right, column-shadows-
binding, and the `unknown_identifier` case. `querying.md` (the leaf-resolution
section and the deferred-features note) and `supported-formulas.md` updated; the
`evaluate.go.md` companion kept verbatim. The parser and AST are unchanged — this is
purely an evaluator-resolution change.
