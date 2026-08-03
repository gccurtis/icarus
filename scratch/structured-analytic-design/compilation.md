# Structured Analytic — compilation to Formula

## The model

**The saved definition is sugar. A Formula expression is the semantics.**

A `StructuredAnalytic` holds pills — inputs, joins, shelves, filters, sorts,
limit, display. Those exist because they are *manipulable*: swapping a column,
changing an aggregation, or reordering a sort is a small structured edit, and
doing the same by rewriting formula text is not.

But nothing about that structure defines what the numbers mean. Meaning comes
from one deterministic function:

```text
compile : AnalyticDefinition → FormulaExpression
```

A pull compiles, evaluates through the Formula engine, and shapes the result.
There is no second evaluator, no parallel semantics, and nothing to keep in sync.

### Direction

Compilation is **one-way**. Arbitrary formulas do not decompile back into pills,
and no attempt is made. Consequences:

- The **definition stays canonical**. It is what is stored, versioned, and
  edited, and it is returned with every pull precisely because the formula
  cannot be turned back into pills for an editor to render.
- The compiled expression is a **derived artifact**. It may be shown, saved to
  Structured Data, or re-derived at any time, and is never the record of
  authoring intent.
- Behaviour the pills cannot express is not reachable by editing compiled text —
  it needs a new pill.

## Research findings that shaped this

Three things were verified against the current engine before settling the
design. Each changed it.

### 1 · `.{…}` covers six operators, not ten

`ConditionOperator` in `ast.ts` is exactly `= != < <= > >=`. Composition is
richer than expected — `,` and `&` for AND, `|` for OR, `^` for XOR, `!` for
NOT, and parenthesised grouping — but the leaf operators are only those six.

Against the filter vocabulary:

| Filter | `.{…}` |
| --- | --- |
| `equals`, `notEquals`, `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual` | native |
| `in` | desugars to an OR chain |
| `contains` | **not expressible** |
| `isNull`, `isNotNull` | **not expressible** — `field = null` parses but its null semantics are not the ones this design specifies |

### 2 · `.{…}` field names must be identifiers

`parseFieldCondition` rejects anything but an `identifier` token. Formula
identifiers are `[A-Za-z_][A-Za-z0-9_]*`, while table field names are arbitrary
strings. Compiling filters to `.{…}` therefore forces a mangling scheme —
generated names like `c1..cn` — which then have to be mapped back on the way
out, and which make a *saved* compiled analytic useless because its output
fields would be `c9` rather than `Total`.

### 3 · Formula has no quoted-name syntax

`parsePrimary` builds a `NameNode` only from an `identifier` token. There is no
backtick or bracket form. So a Structured Data entry named `Q3 Orders` cannot be
referenced from **any** formula today — not just a compiled one.

This is a pre-existing Formula gap, not something this design creates, but it
caps what an analytic can name: without it, any project name containing a space
is unanalyzable.

### What follows

Adding a **`WHERE` builtin** — which takes field names as *strings* inside an
options record — solves 1 and 2 at once. And once filters no longer need
identifiers, **no field name anywhere in compiled source is an identifier**, so
the mangling scheme disappears and compiled output can use readable qualified
names.

That is the difference between a saved analytic whose columns are `c1, c2, c9`
and one whose columns are `Orders.region` and `Total`. It is what makes saving a
compiled analytic to Structured Data worth doing at all.

Adding **quoted names** to Formula closes 3, and benefits every formula author
independently of analytics.

## Worked example

Total closed revenue by region, as a bar, top 10:

```json
{
  "inputs": [{ "name": "Orders" }, { "name": "Reps" }],
  "joins": [{ "kind": "left", "left": "Orders", "right": "Reps",
             "on": [{ "leftField": "repId", "rightField": "id" }] }],
  "filters": [{ "field": { "input": "Orders", "field": "status" },
                "operator": "equals",
                "value": { "kind": "text", "value": "closed" } }],
  "columns": [{ "id": "p1", "field": { "input": "Orders", "field": "region" },
                "aggregation": "none", "label": "Region" }],
  "rows":    [{ "id": "p2", "field": { "input": "Orders", "field": "amount" },
                "aggregation": "sum", "label": "Total" }],
  "sorts":   [{ "placementId": "p2", "direction": "desc" }],
  "limit": 10,
  "display": { "kind": "bar" }
}
```

compiles to:

```text
DISPLAY(
  LIMIT(
    SORT(
      GROUP(
        WHERE(
          JOIN(
            ASTABLE(Orders, "Orders"),
            ASTABLE(Reps, "Reps"),
            { kind: "left",
              on: [{ left: "repId", right: "id" }],
              leftAs: "Orders", rightAs: "Reps" }
          ),
          { all: [{ field: "Orders.status", op: "equals", value: "closed" }] }
        ),
        { keys: [{ field: "Orders.region", as: "Region" }],
          aggregates: [{ as: "Total", field: "Orders.amount", fn: "sum" }] }
      ),
      [{ field: "Total", direction: "desc" }]
    ),
    10
  ),
  "bar"
)
```

Readable end to end, in the order the design has always described:
join → filter → group → sort → limit → display.

### Column naming

`JOIN` qualifies every output field as `<inputKey>.<field>`, and `GROUP`
aggregates name their outputs with `as`. Both are plain strings inside record
literals, so nothing has to be identifier-safe.

The final table's field names are therefore the **placement label, or the source
field name when there is no label** — the same names the pull reports in
`AnalyticResultField`. A saved compiled analytic has usable columns without any
rename step. (The example above labels its Columns placement `Region` for
exactly this reason; without the label the column would be `region`.)

Two placements can be individually valid and still both resolve to one output
name — `Orders.region` and `Reps.region`, both unlabelled. `GROUP` would refuse
that at evaluation time, so **the compiler refuses it at compile time instead**,
naming both placement ids and suggesting a label. A definition that can never
evaluate should fail once, when it is saved, not on every pull afterwards.

### Qualification is conditional

`JOIN` is the only thing that prefixes, so **a single-input analytic has no
qualified names at all** — its references compile to the bare field name. The
compiler emits `leftAs` only on the first join, because from the second onward
the accumulated left side already carries prefixes; a second `leftAs` would
double them. For the same reason a chained join's `on.left` is qualified while
its `on.right` never is: `JOIN` resolves `on` names against each side *before*
qualifying its output.

## The Formula builtins

Eight, plus quoted names. Each is independently useful to a formula author
before any of this is wired together, which is the test of whether it belongs in
the language rather than in a capability.

### Options are records with defaults

Every builtin below takes its options as a record. Optional keys are handled by
**defining a default per key inside the builtin** — not by nullable types and
not by positional arguments. So `JOIN(a, b, { on: [...] })` is legal and `kind`
defaults to `"inner"`.

This keeps call sites readable, makes adding an option a non-breaking change,
and avoids introducing a nullability concept the language does not otherwise
have.

### `ASTABLE(value, name)`

Coerces any wire-serializable value into a table.

| Input | Result |
| --- | --- |
| table | unchanged |
| record | unchanged (already one row) |
| list | one column, renamed from Formula's native `value` to `name` |
| scalar | 1 × 1, single field `name` |
| function | type error |

This is the normalization rule from
[canonical-model.md](canonical-model.md#every-structured-data-kind-is-a-table),
moved into the language. It is also what lets a single-input analytic compile
without a join to hang the coercion on.

### `JOIN(left, right, options)`

```text
{ kind: "inner" | "left",          default "inner"
  on: [{ left, right }, ...],      required, nonempty, ANDed
  leftAs: <prefix>,                default "" — no prefix
  rightAs: <prefix> }              default "" — no prefix
```

Exact scalar equality; **null never matches null**. A left join with no match
supplies null for every right field. Many-to-many produces all matching pairs,
preserving left row order then right source order. Output fields are
`<prefix>.<field>` when a prefix is given and the bare field name when it is
not; colliding output names are refused with a message naming the field.

**The prefixes are not inferred, and the compiler always emits them.** An
earlier draft said `leftAs`/`rightAs` default to "the input name", which cannot
work: `ASTABLE` takes a name but a table value carries none afterwards, so
`JOIN` has nothing to infer from. Making it inferable would mean giving tables a
name annotation alongside `display` — more machinery than the compiler emitting
two strings it already knows. In a chained join the compiler passes `rightAs`
only, because the accumulated left side is already qualified.

`JOIN` also enforces its own intermediate row bound, because a join multiplies
rows faster than anything Formula does today and the evaluator's output-side
`maxRows`/`maxCells` would only catch it after the damage.

### `WHERE(table, options)`

```text
{ all: [<predicate>, ...],   default []   — ANDed
  any: [<predicate>, ...] }  default []   — ORed, ANDed with `all`

predicate: { field, op, value?, values?, caseSensitive? }
op: "equals" | "notEquals" | "greaterThan" | "greaterThanOrEqual"
  | "lessThan" | "lessThanOrEqual" | "in" | "contains"
  | "isNull" | "isNotNull"
```

Field names are strings. Kind-strict — no coercion between text, number, and
logic. Ordering accepts number or text. `contains` is literal substring matching
on text with an explicit `caseSensitive` flag. Null participates in `equals`,
`notEquals`, and `in`, and fails ordering and `contains`.

This is a superset of `.{…}` and the reason compiled output needs no mangling.
The existing `.{…}` syntax is untouched and remains the ergonomic hand-written
form for the six comparisons it supports.

### `GROUP(table, options)` and `AGGREGATE(table, options)`

```text
GROUP(table, { keys: [<field> | { field, as }, ...],
               aggregates: [{ as, field, fn }, ...] })
AGGREGATE(table, { aggregates: [{ as, field, fn }, ...] })
```

A key is a bare field name, or `{ field, as }` when the output column should be
named something else. That form exists so a **labelled non-aggregated
placement** carries its label through compilation — without it the column naming
rule below is unreachable for grouping columns and a rename pass would be needed
after all.

`fn` is `sum | count | average | min | max`.

`AGGREGATE` is `GROUP` with no keys — a whole-table rollup — and exists as its
own name because `GROUP(t, { keys: [], aggregates: […] })` reads badly for "just
total this". It differs in exactly two ways, both deliberate:

- **`aggregates` is required and nonempty.** A rollup with nothing to roll up is
  a mistake, whereas `GROUP` with no aggregates is a useful distinct.
- **Over an empty input it still returns one row.** A rollup of nothing is a row
  of empty answers; a grouping of nothing is no groups, so `GROUP` returns none.

`count` counts non-null values and is **0 over an empty group**; `sum`/`average`
require numbers and are exact rationals; `min`/`max` accept number or text, are
kind-strict, and refuse a mixed column; every aggregate ignores nulls, and every
aggregate *except* `count` yields null over an empty group.

### `SORT(table, [{ field, direction }, ...])`

Stable multi-key ordering in the order given. `direction` defaults to `"asc"`.
Null sorts last. Number, text, and logic sort only against the same kind.

### `LIMIT(table, n)`

First `n` rows. Positive integer.

### `DISPLAY(table, kind)`

Returns the table **carrying rendering intent** — not a new parallel value kind.

That choice is what makes "any display can be used as a table" true by
construction rather than by a conversion rule: a display *is* its table, so
everything that consumes a table consumes a display and ignores the intent.

The signature is deliberately open at the end. Styling, axes, series options,
and layout are additive third-and-later arguments, or fields of an options
record, without breaking anything already saved. For now `DISPLAY(table, "bar")`
is the whole surface.

Wire representation: the annotation rides on the table arm of `FormulaWireValue`
so `toWire`/`fromWire` round-trip it and non-display consumers ignore it.

### Quoted names

A syntax for referencing a project name that is not identifier-safe. Recommended
form is backticks, since `[` is taken by indexing and `"` by string literals:

```text
`Q3 Orders`.region
```

A lexer token and one `parsePrimary` branch producing the same `NameNode`. It
does not change the binder, the resolver, or name normalization.

Without this, an analytic can only name identifier-safe entries — which would
surface a Formula limitation as an arbitrary-looking analytic rule.

**It is forward-looking as shipped.** Structured Data still validates display
names against `FORMULA_IDENTIFIER` (`^[A-Za-z_][A-Za-z0-9_]*$`), so an entry
named `Q3 Orders` cannot be *created* yet — the quoting works, but there is
nothing that needs it. Relaxing that rule is a separate change with its own
consequences (every existing formula referencing a name would keep working, but
the set of legal names widens permanently), so it is deliberately not bundled
here. The lexer half landing first means the day the rule relaxes, nothing else
has to change.

## Where validation lives

| When | What | Failure |
| --- | --- | --- |
| **Save** | the definition is structurally coherent and **compiles** | 400 |
| **Pull** | the compiled expression evaluates against current data | 422 |

Compiling at save is a stronger check than shape validation alone: a definition
that cannot be lowered is rejected before it is stored. The compiled expression
is not persisted — it is cheap to re-derive, and storing it would create a
second thing to keep consistent with the definition.

## What the capability no longer contains

- `domain/executor.ts` — joins, filters, grouping, sorting, limiting are Formula
  builtins.
- `domain/normalize.ts` — becomes `ASTABLE`.
- All rational arithmetic — Formula does it, so the capability needs no rational
  helpers and the `#formula` barrel needs no new exports.

What remains is small: model, validation, **compiler**, store, service, wire,
endpoints.

The rules the executor would have implemented do not disappear — they become the
**specification of the builtins**, tested in Formula's own suite where every
consumer benefits.

## Receipts come from evaluation

```ts
interface FormulaEvaluation {
  value: FormulaValue;
  observedDependencies: readonly ObservedDependency[];  // reference.bindingId + ownerRevision
  dependencyDigest: string;
  evaluationDigest: string;
  steps: number;
}
```

`AnalyticPull.sources` is built from `observedDependencies` rather than from
bookkeeping the capability maintains itself, so the receipt is authoritative by
construction: it reports the bindings the evaluation *read*.

## Saving a compiled analytic

Because the compiled form is an ordinary Formula expression with readable output
columns, saving one to Structured Data needs no new machinery — see
[derived-tables.md](derived-tables.md).

A saved analytic that is itself used as another analytic's input is ordinary
formula composition: the resolver's existing fixpoint ordering resolves it, and
its existing `cycle_error` rejects a loop. No new cycle detection is required.
