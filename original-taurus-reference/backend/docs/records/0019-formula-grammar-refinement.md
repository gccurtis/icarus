# 0019 — Formula grammar refinement

Three coordinated, breaking changes to the `formula/v1` language, driven by
`docs/superpowers/specs/2026-07-20-formula-grammar-refinement.md`. Formula is
unwired (no consumer), so the breakage is safe. Landed in two increments; this
record grows with them.

## Increment 1 — positional brackets and identifier-only field names

### `core/capability/formula/syntax.go` · `value.go`

Field names are now **identifiers only** — a letter or underscore, then letters,
digits, or underscores. `validFieldName` (in `syntax.go`, beside the lexer's
`isIdentStart`/`isIdentContinue`) is the shared check; `parseRecord` rejects a
non-identifier record key at parse time, and `newTable` (the single choke point
every record and table flows through) rejects one built through the Go value API.

**What / goal / why:** a name a dot cannot spell — one containing a space, say — is
no longer a legal field name anywhere. This removes the only thing text-indexing
was for and makes `.field` the one field syntax. (Confirmed nothing in the merged
tree uses non-identifier field names.) Projection/query field names are tightened in
increment 2, which rewrites those parse paths.

### `core/capability/formula/evaluate.go`

`[ ]` is now **positional only**. The evaluator's `NodeIndex` case no longer routes
a bare-identifier index to field access, and `evalIndex` no longer routes a text
index to field access — a non-number index is `invalid_index`, and a record is not
indexable at all (`record[...]` is rejected; use `.field`).

**What / goal / why:** `people["score"]` and `people[score]` (field-by-name in
brackets) are gone; `[ ]` means a numeric index or a slice, and the index is just an
expression that must evaluate to a number — `people[position]` works with no
parentheses, and `people[(position)]` is now ordinary grouping rather than a special
"force numeric" form. The overload between positional and field access — and the
parens escape hatch it required — is removed.

### Tests & docs

`TestEvaluateBindingsCollectionsFieldsAndIndexes` updated (field-by-dot,
index-by-binding, parens-as-grouping); `TestEvaluateStableErrorsAndLimits` gains
positional-only and identifier-name rejections. `querying.md` (field access +
indexing + the axes diagram), `supported-formulas.md` (grammar `field-name` /
`record-field`), and `data-model.md` (record field-name rule) updated to match, with
the `syntax.go.md` / `value.go.md` / `evaluate.go.md` companions kept verbatim.

## Increment 2 — boolean query predicates

### `core/capability/formula/syntax.go`

A dot-curly query is now a **boolean predicate tree** instead of a flat conjunction.
Five node types (`NodePredAnd`/`Or`/`Xor`/`Not`/`Compare`) replace the old
`Condition` slice; `NodeQuery` carries a `Predicate *Node` root. A recursive-descent
`parsePredicate` family parses it, one function per precedence level — loosest to
tightest: `,` (AND) · `||` (OR) · `^` (XOR) · `&&` (AND) · `!` (NOT), with `( )`
grouping. Comma and `&&` both build `NodePredAnd`. `parseSelection` picks projection
vs. query with a one-token lookahead (`peekAt`): a leading `(`/`!`, or a field
followed by a comparison operator, is a query; a bare field list is a projection
(identifier field names only).

**What / goal / why:** the query language gains OR, XOR, NOT, and grouping — the
"advanced querying" that a fixed comma-AND could not express — while keeping every
existing `.{a, b}` (comma stays the outermost AND). A leaf's right-hand side is
parsed at the `additive` level, deliberately below the predicate's own operators, so
a predicate-level `||`/`^`/`&&` is never swallowed by the RHS and an arithmetic `^`
(power) inside the RHS stays distinct from a predicate-level `^` (XOR). One
consequence, documented: **XOR operands must be parenthesized** (`(a) ^ (b)`).

### `core/capability/formula/syntax.go` — DoS re-validator

`validateExpression` gains cases for the five predicate node types (push children;
re-check the field name and operator on each `NodePredCompare`). Because predicates
are ordinary `Node`s, the existing iterative walk bounds them by the same `MaxNodes`
/ `MaxDepth` ceilings — a forged or cyclic predicate tree is caught exactly as any
other forged AST is.

### `core/capability/formula/evaluate.go`

`evalQuery` resolves the predicate once (`resolvePredicate`: bind each comparison
leaf to its column and evaluate its RHS a single time in binding scope) into a
`resolvedPredicate` tree, then keeps each row for which `matchPredicate` holds.
`matchPredicate` walks the tree per row — `&&`/`||` short-circuit, `^` is operand
inequality, `!` negates — charging a step per comparison so per-row work stays
bounded.

### Tests & docs

`TestBooleanQueryPredicates` covers OR/AND/NOT/XOR, comma-as-AND, `&&`-over-`||`
precedence, parenthesized grouping, a binding RHS, and the parenthesize-XOR rule;
the forged-AST re-validation and parse-shape tests were updated to the predicate
representation. `querying.md` (dot-curly selection, the precedence table, the
deferred-features note) and `supported-formulas.md` (query EBNF, AST node list, the
postfix table) updated; the `syntax.go.md` / `evaluate.go.md` companions kept
verbatim.
