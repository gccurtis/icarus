# Formula

Evaluation. An expression is text on the block that holds it, computed on demand
and stored nowhere.

## Public Surface

| Function | Kind | Answers |
| --- | --- | --- |
| `evaluate` | query | what an expression is worth, given the cells around it |

Registered in
[`src/convex/capabilities/formula.ts`](../../../convex/capabilities/formula.ts).

## Data Ownership

**No `schema.ts` and no table.** There is nothing to persist beyond the
expression and its resolved value, and both live on the
[block](../content/types/block.ts). A formulas table would be a second home for
text that a change set already versions.

## The dependency runs one way

`evaluate` resolves a bare name by asking the
[name manager](../name-manager/overview.md) for anything that is not one of its
builtins. The name manager evaluates nothing and asks this for nothing — which
is what keeps a store and an evaluator from depending on each other in a circle.

A name holding a list or a record arrives as a table, through the name manager's
own [projection](../name-manager/types/types.md). So `SUM(Quarters)` works
whether `Quarters` was declared a list or a table.

## What pass 2 evaluates

Arithmetic (`+ - * / ^` and negation), cell references, ranges, text and logic
literals, name lookup, and five aggregates: `SUM`, `AVERAGE`, `MIN`, `MAX`,
`COUNT`.

**The relational builtins are out of scope and deliberately absent.** `JOIN`,
`WHERE`, `GROUP`, `AGGREGATE`, and `SORT` are what an analysis compiles to, and
they arrive with analyses in pass 8. Half-building them here would fix their
semantics before the capability that defines them exists, and a formula that
half-works is worse than one that says it does not. So is calling a named
`function` variable: they are stored, and pass 2 does not run them.

Sheet-qualified references (`Sheet1!A1`) and absolute ones (`$A$1`) are pass 3's,
with the grid.

## Capability Invariants

- **An error is a state, not a value.** `FormulaValue` has no error kind, so a
  consumer holding a value never re-checks whether it really is one. A failed
  formula is `state: "error"` and a message.
- **A refusal becomes a result; a fault stays a fault.** `evaluate` catches
  `FormulaError` and nothing else — a database that failed is not a red cell.
- **`empty` is not zero, an empty string, or a failure.** A reference to a blank
  cell answers `empty`; arithmetic on one refuses rather than coercing; and an
  aggregate skips it rather than counting a gap as a value.
- **Text is refused where a number was needed**, rather than passed over. That is
  the same rule in the other direction: silently ignoring a value that is there
  is as wrong as silently counting one that is not.
- **A bare name has no spaces.** `=TargetMargin * 2` is unambiguous only because
  of that, and it is why the name manager's key drops whitespace rather than
  tidying it.
- **A cell reference is decided by shape**, at parse time. `Q3` is a cell, not a
  variable — which is what makes an expression mean the same thing wherever it is
  pasted.

## Related

[content block](../../../../../docs/data-models/content/content-block.md#formula-blocks)
— the block this computes for ·
[name manager](../name-manager/overview.md) — where a bare name resolves ·
[analysis](../../../../../docs/data-models/data/analysis.md) — the pass 8
consumer of the relational builtins
