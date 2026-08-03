# Structured Analytic — canonical model

## Saved record

```ts
interface StructuredAnalytic {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly definition: AnalyticDefinition;

  /** Compare-and-swap target for update and delete. Starts at 1. */
  readonly revision: number;

  readonly createdBy: string;
  readonly updatedBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
```

There is no `deletedAt`. Delete archives the final snapshot into the shared
resource-history table and removes the current row, matching the model every
other revisioned capability now uses — see [store.md](store.md).

`revision` prevents a stale editor from overwriting a newer edit. It is also the
history key: each accepted update archives the *previous* revision before
writing the new one.

An update replaces title, description, and definition wholesale. There is no
patch language for individual shelves or filters.

## Definition

```ts
interface AnalyticDefinition {
  /** Nonempty. The first input is the root of the join sequence. */
  readonly inputs: readonly AnalyticInput[];
  readonly joins: readonly AnalyticJoin[];

  readonly rows: readonly AnalyticFieldPlacement[];
  readonly columns: readonly AnalyticFieldPlacement[];
  readonly filters: readonly AnalyticFilter[];
  readonly sorts: readonly AnalyticSort[];
  readonly limit?: number;

  readonly display: AnalyticDisplay;
}

interface AnalyticInput {
  /** Structured Data display name, stored as authored. The selector. */
  readonly name: string;
  /**
   * A second label for this input, needed only when one definition uses the
   * same name twice — that is, a self-join. Omitted in ordinary definitions.
   */
  readonly as?: string;
  /**
   * Best-effort record of which entry this name meant when it was saved.
   * A repair hint for rename recovery, never the selector. See "Rename".
   */
  readonly entryId?: string;
}
```

### How an input is referenced

An input's **key** is `as ?? name`. Everything that points at an input — field
references and join sides — uses that key:

```ts
interface AnalyticFieldRef {
  /** An input key: the name, or its `as` label when one was supplied. */
  readonly input: string;
  /** Exact, case-sensitive field name in the normalized input table. */
  readonly field: string;
}
```

So the common definition reads the way the author thinks about it:

```json
{ "input": "Orders", "field": "region" }
```

Keys are matched case-insensitively, the same normalization Structured Data and
the Formula resolver already apply to names, and they must be unique within one
definition. Qualifying by input key is what prevents field-name collisions
between inputs — `Orders.region` and `Regions.region` are distinct without extra
machinery. `as` exists so a self-join has two distinct keys over one name.

`as` is also the seam for a future **computed input**: an input defined by an
expression over other inputs rather than by a project name would carry `as` plus
an expression instead of `name`. Keeping `as` now means that variant slots in
without changing how anything refers to an input.

## Every Structured Data kind is a table

An input is any project name whose resolved value is wire-serializable — which
is every kind except `function`. All of them normalize to a table, because a
table is the general case and the others are degenerate versions of it.

| Resolved value | Normalized table | Fields |
| --- | --- | --- |
| **table** | as-is | its own field names |
| **record** | one row, many columns | its own field names |
| **list** | one column, one row per element, source order preserved | one field named the **input key** |
| **scalar** (`null`, `number`, `text`, `logic`) | 1 × 1 | one field named the **input key** |
| **function** | rejected | — |

So a variable holding `42`, named `TargetMargin`, is addressed as
`{ input: "TargetMargin", field: "TargetMargin" }` — a one-row, one-column table
whose single cell is `42`. A list named `Regions` is
`{ input: "Regions", field: "Regions" }` with one row per element.

This means **every usable Structured Data name is a valid input**, which is the
point: the author should not have to know whether something was declared as a
list, a record, or a table before they can put it on a shelf.

Two notes on the mechanics:

- Formula's native list value already carries a single field literally named
  `value` (`makeList` builds `fields: ["value"]`). Normalization **renames** it
  to the input key, so definitions read in the author's vocabulary rather than
  Formula's internal one.
- A scalar has no field name of its own, so the input key is the only sensible
  choice, and it makes scalars and lists consistent.

This rule is implemented as the Formula builtin `ASTABLE(value, name)` rather
than as capability code — see [compilation.md](compilation.md).

A list's single column is an ordinary joinable, filterable, aggregatable field
like any other — it is the only column it has, so it is the only one you could
address. Row order is the list's authored order, and **positions are 1-based**,
which is the indexing convention throughout Formula and this capability.

## Shelf placements

```ts
type AnalyticAggregation =
  | "none"
  | "sum"
  | "count"
  | "average"
  | "min"
  | "max";

interface AnalyticFieldPlacement {
  /** Unique across Rows and Columns in one definition. */
  readonly id: string;
  readonly field: AnalyticFieldRef;
  readonly aggregation: AnalyticAggregation;
  readonly label?: string;
}
```

Rows and Columns are the only shelves. One placement is one pill. Its ID lets a
sort target that exact placement even when the same source field appears twice
with different aggregations.

Field names are matched **case-sensitively** — they come from inside a table
value, not from the project name space, and Formula does not normalize them. The
exception is the synthesized field on a list or scalar input, which is the input
key and therefore matches the way keys match.

The first version addresses top-level fields only. A nested value may sit in an
unused source field, but any field that is selected, filtered, sorted,
aggregated, or joined on must resolve to a scalar. Data needing deeper
projection should be shaped first as a named Structured Data or Formula table.

## Display

```ts
type AnalyticDisplayKind =
  | "table"
  | "bar"
  | "line"
  | "area"
  | "scatter"
  | "pie";

interface AnalyticDisplay {
  readonly kind: AnalyticDisplayKind;
}
```

The field is `display`, not `graph`, because a table is a first-class output of
this capability and not a fallback for "no chart". An analytic that produces a
joined, filtered, aggregated table is doing exactly the job this capability
exists for.

Display is saved authoring intent and travels back out with every pull. The
backend still returns tabular data; the frontend owns rendering.

**It is an object rather than a bare enum on purpose.** The renderings this will
plausibly grow into — two panels side by side, a bar series with a line
overlaid, a secondary axis — are all *additive* to this shape: a new optional
field, or a new `kind` variant carrying its own layer list. A bare string would
force a migration of every persisted definition on the first such change.

Each kind states a small **structural** contract, checked when the definition is
saved because it depends only on the definition:

| Display | Structural shelf contract |
| --- | --- |
| `table` | at least one Rows or Columns placement |
| `bar`, `line`, `area`, `pie` | exactly one non-aggregated Columns placement and exactly one aggregated Rows placement |
| `scatter` | exactly one non-aggregated Columns placement and exactly one non-aggregated Rows placement |

These are counts and aggregation flags — facts about the recipe, knowable
without data. Whether a measure actually resolved to numbers depends on what is
in the project today and is checked during the pull. Non-table displays produce
one series in this version. Color, size, tooltip, facets, formatting,
orientation, and stacking are not part of this contract.

## Joins

```ts
type AnalyticJoinKind = "inner" | "left";

interface AnalyticJoinKey {
  readonly leftField: string;
  readonly rightField: string;
}

interface AnalyticJoin {
  readonly kind: AnalyticJoinKind;
  /** Input keys. */
  readonly left: string;
  readonly right: string;
  /** Nonempty equality-key list. Multiple keys are ANDed. */
  readonly on: readonly AnalyticJoinKey[];
}
```

Joins are an ordered, left-deep sequence rather than a plan graph:

1. `inputs[0]` is the root.
2. `joins[i]` adds `inputs[i + 1]` as its `right`.
3. `left` must already have been introduced.
4. Every later input is added exactly once.

This supports ordinary chained joins while making cycles and disconnected inputs
structurally impossible. Right joins are expressed by ordering the inputs
differently. Full, cross, and non-equality joins are outside this version.

Join keys use exact scalar equality: equal rationals match, text and logic match
only the same kind and value, and **null never matches null**. A left join with
no right match supplies null for every field of that right input. Many-to-many
matches produce all matching row pairs, preserving left row order and then
source right-row order.

Because a scalar input normalizes to a 1 × 1 table, joining a table to a scalar
is expressible and behaves as a broadcast — every left row matches the single
right row when the keys are equal. That falls out of the normalization rather
than needing its own rule.

## Filters

```ts
type AnalyticScalar =
  | { readonly kind: "null" }
  | {
      readonly kind: "number";
      readonly numerator: string;
      readonly denominator: string;
    }
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "logic"; readonly value: boolean };

type AnalyticFilter =
  | {
      readonly field: AnalyticFieldRef;
      readonly operator:
        | "equals"
        | "notEquals"
        | "greaterThan"
        | "greaterThanOrEqual"
        | "lessThan"
        | "lessThanOrEqual";
      readonly value: AnalyticScalar;
    }
  | {
      readonly field: AnalyticFieldRef;
      readonly operator: "in";
      readonly values: readonly AnalyticScalar[];
    }
  | {
      readonly field: AnalyticFieldRef;
      readonly operator: "contains";
      readonly value: string;
      readonly caseSensitive: boolean;
    }
  | {
      readonly field: AnalyticFieldRef;
      readonly operator: "isNull" | "isNotNull";
    };
```

`AnalyticScalar` is deliberately the scalar arm of `FormulaWireValue` verbatim,
including numbers as a numerator/denominator string pair, so filter literals and
result cells share one representation and no conversion layer exists.

All filters are ANDed and run after joins but before aggregation. Comparisons do
not coerce between text, number, and logic. Ordering comparisons accept number
or text. `contains` accepts text and performs literal substring matching. An
`in` filter must carry at least one value. Null participates in equality and
`in`, but fails ordering and `contains`.

A numeric literal compiles to an **exact division expression**
(`<numerator>/<denominator>`), which Formula evaluates as a rational rather than
a float — so `1/3` survives compilation without becoming a decimal
approximation. The decoder validates both parts as integers with a nonzero
denominator; no reduction is required, because nothing compares stored literals
for identity.

## Aggregation, sorting, and limit

If no placement aggregates, the compiled expression projects one result row per
joined and filtered input row.

If any placement aggregates, every `aggregation: "none"` placement across Rows
and Columns becomes a grouping key.

| Aggregation | Accepted values | Null behaviour | Result |
| --- | --- | --- | --- |
| `count` | any scalar | ignored | exact integer |
| `sum`, `average` | number | ignored | exact number; null when empty |
| `min`, `max` | number or text | ignored | same kind; null when empty |

`GROUP` and `AGGREGATE` perform the arithmetic inside Formula, so an average is
an exact rational rather than a floating-point approximation, and this
capability implements no arithmetic of its own.

```ts
interface AnalyticSort {
  /** ID of a Rows or Columns placement. */
  readonly placementId: string;
  readonly direction: "asc" | "desc";
}
```

Sorts run over the projected result, in authored order, after aggregation. They
are stable: equal values keep their prior order. Null sorts last. Number, text,
and logic sort only against the same kind. The optional positive integer `limit`
applies after all sorts.

## The pull

```ts
type AnalyticResultKind =
  | "number"
  | "text"
  | "logic"
  | "unknown"
  | "mixed";

type AnalyticShelf = "row" | "column";

interface AnalyticResultField {
  readonly placementId: string;
  readonly name: string;
  readonly shelf: AnalyticShelf;
  readonly kind: AnalyticResultKind;
  readonly aggregation: AnalyticAggregation;
}

/** How one input resolved, and what it was, when this pull read it. */
interface AnalyticSourceRead {
  /** The input key, so a self-join reports both sides. */
  readonly input: string;
  /** The Structured Data name that answered, current as of this pull. */
  readonly name: string;
  /** The entry that answered. Stable across renames. */
  readonly entryId: string;
  /** Revision of that entry at read time. */
  readonly revision: number | string;
  readonly status: "ok" | "renamed" | "retargeted";
}

interface AnalyticPull {
  readonly analyticId: string;
  /** The saved definition revision this calculation used. */
  readonly analyticRevision: number;
  /**
   * The pills that produced this data, at the captured revision. Returned
   * because compilation is one-way: a client cannot recover them from the
   * result, and an editing surface needs them alongside the table.
   */
  readonly definition: AnalyticDefinition;
  readonly display: AnalyticDisplay;
  /** Rows placements first, then Columns placements, preserving shelf order. */
  readonly fields: readonly AnalyticResultField[];
  readonly rows: readonly (readonly AnalyticScalar[])[];

  /** Receipt: exactly what was read. */
  readonly sources: readonly AnalyticSourceRead[];
  readonly pulledAt: string;
}
```

### Why the definition rides along

Compilation is one-way. A Tableau-like client showing a chart also has to show
the pills that made it, and it cannot reconstruct them from the rows or from the
compiled formula. Returning the definition means one round trip renders both the
visualization and its editor, and guarantees the pills shown are exactly the
ones that produced the numbers shown — not a later revision fetched separately.

`analytic.get` still exists for the pills alone, which is the cheaper call when
no data is wanted.

`name` on a result field is the placement label when present, otherwise the
source field name. Duplicate names are allowed because placement ID and array
position identify a result column. `unknown` means no non-null value was
available to infer a kind.

`AnalyticPull` is returned and then discarded. It has no ID, status, lifecycle,
or persistence row.

### Revision is the whole receipt — deliberately no digests

Earlier drafts also carried a per-input `valueDigest` and a project-wide
`snapshotDigest`. Both are removed.

A digest can only answer "is the value I have now identical to the value I had
then". It cannot say what the value *was*, or why it changed, and there is no
revision to travel back to and inspect. It buys a boolean nobody can act on.

`revision` is the useful identity because it is an address: it names a point in
that entry's history you can go and look at.

There is a real gap in that, and it is named rather than papered over: **a
formula-backed entry's revision does not move when its inputs move.**
`Total = SUM(Orders.amount)` keeps its revision forever while its value tracks
`Orders`. A digest would detect that but tell you nothing useful about it.

The correct fix is upstream, not here: **a Structured Data entry's revision
should advance when an entry it depends on advances**, propagating through the
dependency graph. Then revision alone is both an address and a complete change
signal, and this capability needs nothing further. That is recorded as the first
the "Structured Data revisions should propagate to dependents" item in
[`0-general-updates.md`](../0-general-updates.md), and is not required
for the first version.

The project-wide `snapshotDigest` was worse: it digests every entry, so an edit
to anything unrelated changes it. It remains useful only for correlating log
lines, and is logged rather than returned.

## Rename, and why a pull can survive one

Names are the selector, and Structured Data keeps them unique among live entries.
But an entry can be renamed, and the dependency direction is one-way — Structured
Data cannot notify Structured Analytic that anything happened.

The definition therefore records `entryId` as a **best-effort repair hint**,
captured at save time from a cheap metadata read. It is never the selector, and
its absence is never a save failure: an analytic naming something that does not
exist yet still saves.

Resolution at pull time:

```text
look up by normalized name
├─ hit, and entryId matches (or is absent)   → status "ok"
├─ hit, but entryId is set and differs       → status "retargeted"
│    the name now means a different entry than it did when saved.
│    The pull succeeds — the name is the authority — and says so.
└─ miss
   ├─ entryId still resolves                 → status "renamed"
   │    the entry was renamed. Use it, report its new name, pull succeeds.
   └─ entryId missing or unset               → error: input not found (422)
```

This gives retargeting without inverting the dependency: nothing pushes, and the
analytic repairs its own view on the next read.

### Self-healing the stored name

When resolution reports `renamed`, the stored `name` is **rewritten to the
entry's current name**. The name in a definition is a cached label for an
identity that did not change; refreshing it is bookkeeping, not authoring. Both
`analytic.pull` and `analytic.check` perform this repair.

The repair is a **single conditional statement**, not a read-modify-write:

```sql
UPDATE analytics
   SET definition_json = ?
 WHERE id = ? AND revision = ?
```

Conditioned on the revision it read, so a concurrent authored edit always wins
and the repair simply does not apply — it will happen on the next pull anyway.
That keeps `pull` safe on the concurrent queue despite writing.

**The repair does not advance `revision`.** This is the one place worth being
careful: `revision` is the optimistic-concurrency token every editor holds. If a
pull bumped it, any client with an open editor would find its `expectedRevision`
stale because somebody else looked at a chart. Renames are rare, authored edits
are not, and breaking editors to record a label refresh is the wrong trade.

If an observable marker for "sources were re-synced" is wanted later, it belongs
in a separate `sourcesSyncedAt` column that no CAS reads — not in `revision`.

## Project-data seam

Because the compiled expression names project entries directly, the capability
does not fetch values at all. It needs the **snapshot** to hand to Formula, and
cheap **metadata** for `entryId` capture and freshness checks:

```ts
interface ProjectDataPort {
  /** One resolver snapshot; the caller memoizes it for the duration of a pull. */
  snapshot(): Promise<FormulaResolverSnapshot>;

  /** Cheap: id, name, revision. No formula evaluation. */
  metadata(): Promise<readonly {
    id: string;
    name: string;
    revision: number | string;
  }[]>;
}
```

Both input resolution and rename repair read `snapshot.bindings` — keyed by
normalized name, scanned by `reference.bindingId` only for inputs whose name
already missed — so a repaired input can never read a different project state
than its siblings.

Three outcomes are distinguished when an input does not resolve, because they
mean different things to an author:

| Outcome | Meaning | Result |
| --- | --- | --- |
| binding present | resolved | proceed |
| absent, `getIssue(entryId)` returns an issue | the entry exists but its formula is broken upstream | 422 with the issue |
| absent, no issue | no such name, and no recorded entry resolves either | 422 not found |

`metadata()` maps onto Structured Data's existing `list()`, which reads rows
without evaluating anything. It backs the save-time `entryId` capture and the
freshness check in [operations.md](operations.md#freshness).

`FormulaResolutionIssue` is defined in `1-init`, so the adapter — not the
capability — translates it into the capability's own diagnostic vocabulary.

## Execution order

The definition is **sugar**; a Formula expression is the semantics. A pull
compiles and evaluates rather than interpreting — see
[compilation.md](compilation.md).

```text
 1  load the saved analytic (revision captured here)
 2  compile the definition to a Formula expression
 3  build ONE resolver snapshot; repair any renamed input's cached name
 4  formula.evaluate(expression, snapshot, limits)
       ASTABLE → JOIN → .{filters} → GROUP/AGGREGATE → SORT → LIMIT → DISPLAY
 5  check the display's data-dependent expectations
 6  map compiled columns back to result fields
 7  return AnalyticPull with the captured revision, saved display, and a receipt
    built from the evaluation's observedDependencies
```

Steps 4 and 5 are the only places project data is touched, and both happen
inside one evaluation against one snapshot.

## Invariants

1. The definition is the canonical record; the compiled expression is derived,
   one-way, and never persisted.
2. Names, matched case-insensitively, select project inputs; `entryId` repairs
   renames but never selects.
3. An input is referenced by its key — its name, or its `as` label.
4. Every wire-serializable Structured Data kind is a valid input, normalized to
   a table by `ASTABLE`.
5. One pull evaluates against one Formula snapshot.
6. Inputs are combined only by the saved ordered join list.
7. Joins and filters run before grouping and aggregation.
8. Sorts and limit run after grouping and aggregation.
9. Exact Formula numbers stay exact in result rows, because Formula does the
   arithmetic.
10. Rows and Columns are the only placement authorities.
11. Display is saved authoring intent, returned with every pull, and carried on
    the value by `DISPLAY`.
12. Every pull reports the analytic revision and, per input, the entry, its
    current name, its revision, and the resolution status it read.
13. A pull never changes Structured Data, is never persisted, and changes the
    analytic only by self-healing a renamed input's cached name — which never
    advances `revision`.
