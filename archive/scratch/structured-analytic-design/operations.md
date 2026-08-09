# Structured Analytic — operations

## Runtime

```ts
type AnalyticCommand =
  | { readonly type: "analytic.create"; readonly input: CreateAnalyticInput }
  | { readonly type: "analytic.update"; readonly input: UpdateAnalyticInput }
  | { readonly type: "analytic.delete"; readonly input: DeleteAnalyticInput }
  | { readonly type: "analytic.purge"; readonly input: PurgeAnalyticInput }
  /** Save the compiled formula to Structured Data under a name. Stays live. */
  | { readonly type: "analytic.save"; readonly input: SaveAnalyticInput }
  /** Resolve now and store the rows as a literal table. Frozen. */
  | { readonly type: "analytic.copy"; readonly input: CopyAnalyticInput };

type AnalyticCommandResult =
  | { readonly type: "analytic.created"; readonly analytic: StructuredAnalytic }
  | { readonly type: "analytic.updated"; readonly analytic: StructuredAnalytic }
  | { readonly type: "analytic.deleted"; readonly analyticId: string }
  | { readonly type: "analytic.purged"; readonly analyticId: string }
  | {
      readonly type: "analytic.saved";
      readonly analyticId: string;
      readonly entry: { readonly id: string; readonly name: string; readonly revision: number };
    }
  | {
      readonly type: "analytic.copied";
      readonly analyticId: string;
      readonly entry: { readonly id: string; readonly name: string; readonly revision: number };
      readonly rowCount: number;
    };

type AnalyticQuery =
  | { readonly type: "analytic.get"; readonly id: string }
  | { readonly type: "analytic.list" }
  | { readonly type: "analytic.pull"; readonly id: string }
  | { readonly type: "analytic.check"; readonly id: string };

type AnalyticQueryResult =
  | { readonly type: "analytic.record"; readonly analytic: StructuredAnalytic }
  | { readonly type: "analytic.records"; readonly analytics: readonly StructuredAnalytic[] }
  | { readonly type: "analytic.pull"; readonly pull: AnalyticPull }
  | { readonly type: "analytic.check"; readonly check: AnalyticCheck };

interface StructuredAnalyticCapability {
  command(command: AnalyticCommand): Promise<AnalyticCommandResult>;
  query(query: AnalyticQuery): Promise<AnalyticQueryResult>;

  pruneHistory(cutoff: string): Promise<number>;
  purgeExpired(cutoff: string): Promise<number>;
}
```

`CreateAnalyticInput` is `{ title, description?, definition }`;
`UpdateAnalyticInput` adds `id` and `expectedRevision` and replaces the
definition wholesale; `DeleteAnalyticInput` is `{ id, expectedRevision }`;
`PurgeAnalyticInput` is `{ id }`; `SaveAnalyticInput` and `CopyAnalyticInput`
are both `{ id, name, description? }`, where `name` is the Structured Data
display name to declare.

Both dispatch methods are total switches with no `default`, so adding a variant
is a compile error until it is handled.

`createdBy` / `updatedBy` come from composition attribution (`config.userId`),
never from the request payload.

## Save and copy

Two ways for an analytic to become project data. Both go through one narrow
`StructuredDataWriter` port implemented in `1-init`; the capability never
imports `#structured-data`.

| | `analytic.save` | `analytic.copy` |
| --- | --- | --- |
| Writes | a `variable` entry whose body is the compiled formula | a `table` entry holding resolved rows |
| Freshness | **live** — re-resolves whenever the snapshot rebuilds | frozen at the moment of the copy |
| Cost at write | compile only, no evaluation | one full pull |
| Breaks if a source is renamed | yes, like any formula | no |

**Save is nearly free, and that is the point.** A compiled analytic is an
ordinary Formula expression with readable output columns, so declaring it under
a name produces an ordinary formula-backed entry. Every read re-resolves it
against current data because that is simply what formula-backed entries do.
Nothing pushes, nothing schedules, and no capability learns about another.

A saved analytic used as another analytic's input is ordinary formula
composition — the resolver's existing fixpoint ordering handles it and its
existing `cycle_error` rejects a loop.

**Copy is the deliberate freeze.** A quarterly report that must *not* move later
is a copy on purpose, not a degraded save.

Neither command changes the analytic itself, and neither is reversible from this
capability's side: the resulting entry belongs to Structured Data and is edited,
versioned, and deleted there.

## Validation split

This is the difference between *checking the recipe* and *checking the
ingredients*, and the two happen at different times because they can be known at
different times.

**At save time (create and update)** the runtime validates everything that
depends only on the definition:

- nonempty inputs; unique input keys; every `name` nonempty and within limits;
- the ordered join shape — `joins[i]` introduces `inputs[i+1]`, `left` already
  introduced, every input introduced exactly once, nonempty `on` list;
- every field reference names a declared input key;
- unique placement IDs across Rows and Columns; valid aggregation enums;
- every sort targets a declared placement ID;
- filter operator/value shapes, and at least one value for `in`;
- a positive integer `limit`;
- the display's **structural** contract; and
- that the definition **compiles** — a definition the compiler cannot lower to a
  Formula expression is rejected before it is stored, which is a stronger check
  than shape validation alone.

That last one is worth being precise about. The structural contract is a
statement about *the definition*, not the data: a `bar` requires exactly one
non-aggregated placement on Columns and exactly one aggregated placement on
Rows. Those are counts of placements and their aggregation flags, fully
determined by what the author saved. A bar chart with two measures and no
dimension can never render for any data, so it is rejected at save with a 400
rather than failing on every pull forever after.

Save also performs one **cheap metadata read** to capture `entryId` for each
input name that currently resolves. This is best-effort: a name that does not
exist yet leaves `entryId` unset and the analytic still saves. It never
evaluates a formula and never fails validation.

**At pull time** come the checks that require data, and cannot be moved earlier
because the answer changes minute to minute:

- the input still resolves, by name or by recorded `entryId`;
- its value is wire-serializable and not a function;
- referenced fields exist in the normalized input table;
- joined, filtered, and aggregated cells are scalars of a compatible kind —
  including whether a measure the display needs to be numeric actually *is*
  numeric;
- the configured row and cell limits hold.

These are 422s. The request was well-formed and the saved definition is
structurally valid; the project data cannot satisfy it right now.

## Producing a pull — `analytic.pull`

```text
read the current analytic by id            → capture id + revision
  → compile the definition                 → a FormulaExpression
  → projectData.snapshot()                 → ONE resolver snapshot
       any input name missing → look it up by recorded entryId in that snapshot
       renamed → repair the cached name (single CAS'd UPDATE, no revision bump)
  → formula.evaluate(expression, snapshot, limits)
       ASTABLE → JOIN → .{filters} → GROUP/AGGREGATE → SORT → LIMIT → DISPLAY
       diagnostics → 422
  → display data checks
  → return AnalyticPull {
      analyticId, analyticRevision, definition, display,
      fields, rows, sources, pulledAt
    }
```

The result table's field names are already the placement labels, because
`GROUP`'s `as` and `JOIN`'s qualification set them during compilation — there is
no mapping step back from generated names.

The **definition rides along** because compilation is one-way: a client
rendering both a chart and its pill editor cannot recover the pills from the
rows, and fetching them separately risks showing a different revision than the
one that produced the numbers.

`sources` is built from the evaluation's `observedDependencies`, so the receipt
reports what the calculation actually read rather than what the capability
intended it to read.

**A pull is always fresh.** It resolves current project data every time. There
is no cached result to invalidate, which is why this capability needs no
refresh job, no staleness flag, and no write-back.

If an update or delete lands after the initial read, the calculation finishes
against the definition it captured, and `analyticRevision` reports which revision
produced the numbers.

The `sources` receipt is assembled during resolution from the same bindings the
evaluation consumes, so it can never describe a different revision than the one
that produced the rows.

## Freshness

Staleness is not a property of an analytic. It is a property of **a pull someone
is still holding**. The analytic itself is never stale — pull it and you get
current data, because current data is the only data it can reach.

```ts
interface AnalyticCheck {
  readonly analyticId: string;
  readonly analyticRevision: number;
  readonly sources: readonly {
    readonly input: string;
    readonly name: string;
    readonly entryId?: string;
    readonly revision?: number | string;
    readonly status: "ok" | "renamed" | "retargeted" | "missing";
  }[];
  readonly checkedAt: string;
}
```

`analytic.check` reads the analytic and calls `projectData.metadata()` — ids, names,
and revisions, **no formula evaluation and no data**. It also performs the same
name self-healing a pull does, so a rename is repaired by whichever call happens
first.

A client holding a pull receipt diffs it against a check to decide whether to
pull again. That is the whole point of keeping `check`: a client watching a live
chart polls something cheap and only pays for a pull when a revision actually
moved, instead of re-pulling on a timer.

**A pull performs the same check first.** It resolves current state, repairs any
renamed input, and then calculates — so a pull's receipt is always the current
truth, and `check` is simply that first half exposed on its own without touching
data.

One honest limit, which is the same gap named in
[canonical-model.md](canonical-model.md#revision-is-the-whole-receipt--deliberately-no-digests):
a formula-backed entry's revision does not move when its own inputs move, so a
check can report "unchanged" for `Total = SUM(Orders.amount)` while the number
has changed. The fix is revision propagation in Structured Data, tracked in
[supplementary-changes.md](supplementary-changes.md). Until then a check is a
reliable *changed* signal and an imperfect *unchanged* one.

### What is deliberately not built

**No background sweep, no scheduler, no active/inactive flag, no presence-driven
refresh.**

- The pull path already reads current data, so a sweep refreshes nothing a pull
  does not.
- A sweep that resolves every analytic's inputs is exactly the expensive
  operation this design avoids doing on a timer.
- "Which analytics are on screen" is knowledge the client has and the backend
  does not. Polling `check` puts the refresh decision where that information
  already is, with strictly less machinery than presence plumbing.

If a server-side need appears later — a scheduled export, a notification — the
retention scheduler is the existing precedent, and `check` is the primitive it
would call.

## Limits

Under compilation the split is clean:

**Formula owns the data-size limits.** `maxRows`, `maxCells`, and
`maxOutputBytes` are enforced by the evaluator, and the new relational builtins
enforce them too. A `limit_exceeded` diagnostic becomes a 422. This capability
does not re-implement any of it.

`JOIN` additionally enforces its own intermediate row bound, because a join
multiplies rows faster than anything Formula does today and the evaluator's
output-side checks would only catch it after the work was done.

**Structured Analytic owns the definition-shape limits**, which are about how
big a recipe may be, not how big its data is:

```yaml
# Structured Analytic limits.
structuredAnalytic:
  maxAnalyticsPerProject: 500
  maxInputs: 8
  maxJoinKeys: 8
  maxPlacements: 32
  maxFilters: 32
  maxSorts: 8
  maxTitleBytes: 4096
  maxNameBytes: 256
```

Exceeding a data limit is an error, not a truncation — a silently truncated
chart is worse than a failed one.

## Endpoints and jobs

| Method and path | Queue | Body | Success |
| --- | --- | --- | --- |
| `POST /structured-analytics/command` | serial | `{ type, input }` | `201` created/saved/copied, `200` updated/deleted/purged |
| `POST /structured-analytics/query` | concurrent | `{ type, … }` | `200` |

**Why serial for commands.** Create reads `countLive()` then inserts, and update
and delete read-then-write across a CAS plus a history insert. The store cannot
enforce the catalog limit on its own, which is the house rule for choosing the
serial queue.

**Why concurrent for queries, including `pull`.** No writes. Promise-concurrent,
running its transformations on the Node.js thread; the configured row and cell
limits keep that bounded. A worker-thread design should only be considered if
measurement shows it is needed.

All jobs are inline. There are no internal stages, deferred jobs, recovery jobs,
or scheduled work beyond the shared retention sweep.

## Errors

| Condition | HTTP | Wire code |
| --- | --- | --- |
| malformed payload or structurally invalid definition | 400 | `validation_error` |
| catalog limit reached | 400 | `catalog_limit_exceeded` |
| analytic absent or deleted | 404 | `not_found` |
| purge on an analytic that still exists | 409 | `not_deleted` |
| stale `expectedRevision` | 409 | `revision_conflict` |
| `save`/`copy` target name already taken | 409 | `name_conflict` |
| input unresolvable, non-tabular, bad field, incompatible join/filter/aggregate/display, or a pull limit exceeded | 422 | `analytic_pull_invalid` |
| unexpected failure | 500 | `internal_error` |

422 mirrors how Structured Data already reports a name that will not resolve
(`resolution_error` carrying a typed issue). The body names which input failed
and distinguishes *not found* from *exists but broken upstream*.

A **renamed** or **retargeted** input is not an error. The pull succeeds and
reports the status per source, because the author's intent is still satisfiable
and hiding the change behind a failure helps nobody.

There is no 503. The Formula resolver has no "unavailable" state — individual
entries fail into typed issues, and an outright snapshot failure is an exception,
which is a 500. The 500 body is a fixed generic message; wiring logs the real
one.

## Logging

```text
structured-analytic.endpoints.registered  info
structured-analytic.create                info
structured-analytic.update                info
structured-analytic.delete                info
structured-analytic.purge                 info
structured-analytic.save                  info
structured-analytic.copy                  info
structured-analytic.get                   debug
structured-analytic.list                  debug
structured-analytic.check                 debug
structured-analytic.pull                  info
structured-analytic.*.rejected            warn
structured-analytic.*.failed              error
```

Command events carry analytic ID, revision, input/join/placement/filter/sort
counts, display kind, and duration. `pull` additionally carries source count,
how many resolved `renamed` or `retargeted`, total input rows, peak intermediate
rows, result rows and fields, the resolver's `snapshotDigest` for correlation,
and total duration.

Logs never contain titles, descriptions, input names, field names, filter
values, source rows, or result rows. Digests are digests, not content, which is
why they are safe to log. Wiring adds the request ID to rejection and failure
events.
