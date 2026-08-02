# Structured Analysis — operations

## Runtime

```ts
interface CreateAnalysisInput {
  readonly title: string;
  readonly description?: string;
  readonly definition: AnalysisDefinition;
}

interface UpdateAnalysisInput {
  readonly id: string;
  readonly expectedRevision: number;
  readonly title: string;
  readonly description?: string;
  /** Complete replacement, not a patch. */
  readonly definition: AnalysisDefinition;
}

interface DeleteAnalysisInput {
  readonly id: string;
  readonly expectedRevision: number;
}

interface PurgeAnalysisInput {
  readonly id: string;
}

type AnalysisCommand =
  | { readonly type: "analysis.create"; readonly input: CreateAnalysisInput }
  | { readonly type: "analysis.update"; readonly input: UpdateAnalysisInput }
  | { readonly type: "analysis.delete"; readonly input: DeleteAnalysisInput }
  | { readonly type: "analysis.purge"; readonly input: PurgeAnalysisInput };

type AnalysisCommandResult =
  | { readonly type: "analysis.created"; readonly analysis: StructuredAnalysis }
  | { readonly type: "analysis.updated"; readonly analysis: StructuredAnalysis }
  | { readonly type: "analysis.deleted"; readonly analysisId: string }
  | { readonly type: "analysis.purged"; readonly analysisId: string };

type AnalysisQuery =
  | { readonly type: "analysis.get"; readonly id: string }
  | { readonly type: "analysis.list" }
  | { readonly type: "analysis.data"; readonly id: string };

type AnalysisQueryResult =
  | { readonly type: "analysis.record"; readonly analysis: StructuredAnalysis }
  | {
      readonly type: "analysis.records";
      readonly analyses: readonly StructuredAnalysis[];
    }
  | { readonly type: "analysis.data"; readonly data: AnalysisData };

interface StructuredAnalysisCapability {
  command(command: AnalysisCommand): Promise<AnalysisCommandResult>;
  query(query: AnalysisQuery): Promise<AnalysisQueryResult>;

  pruneHistory(cutoff: string): Promise<number>;
  purgeExpired(cutoff: string): Promise<number>;
}
```

Both dispatch methods are total switches with no `default`, so adding a command
or query variant is a compile error until it is handled.

`createdBy` / `updatedBy` come from composition attribution (`config.userId`),
never from the request payload — the same rule Comments and Templates follow.

## Validation split

**At save time (create and update)** the runtime validates everything that
depends only on the definition:

- nonempty inputs; unique aliases; every `name` nonempty and within limits;
- the ordered join shape — `joins[i]` introduces `inputs[i+1]`, `leftAlias`
  already introduced, every input introduced exactly once, nonempty `on` list;
- every field reference names a declared alias;
- unique placement IDs across Rows and Columns; valid aggregation enums;
- every sort targets a declared placement ID;
- filter operator/value shapes, and at least one value for `in`;
- a positive integer `limit`;
- the graph's **structural** shelf contract (see
  [canonical-model.md](canonical-model.md#graph)).

It deliberately does **not** require the named project data to exist. A
definition stays editable while its source is being renamed, rebuilt, or
temporarily broken.

**At run time** the checks that need data: the name resolves, the value is
table-like, referenced fields exist in it, joined/filtered/aggregated values are
scalars of a compatible kind, measures for a numeric graph really are numbers,
and the configured size limits hold.

## Producing data — `analysis.data`

```text
read the current analysis by id            → capture id + revision
  → collect the distinct normalized input names
  → reader.readAll(names)                  → ONE Formula snapshot
  → normalize each resolution into an aliased table
  → joins → filters → projection/aggregation → sorts → limit
  → graph data checks
  → return AnalysisData { analysisId, analysisRevision, graph, fields, rows }
```

The call neither updates the analysis nor stores the result. Repeating it simply
reads current project data and calculates again. It needs no idempotency key,
settlement step, or background job.

If an update or delete lands after the initial read, the calculation finishes
against the definition it captured, and `analysisRevision` tells the caller
exactly which revision produced the numbers. There is no current-result pointer
to race over.

## Limits

Structured Analysis gets its own configuration section rather than borrowing
Formula's. Formula's limits are enforced inside the Formula evaluator; this
executor is separate code and must enforce its own bounds explicitly, and the
quantities differ — a join can multiply rows in a way no single formula
evaluation does.

```yaml
# Structured Analysis limits.
structuredAnalysis:
  maxAnalysesPerProject: 500
  maxInputs: 8
  maxJoinKeys: 8
  maxPlacements: 32
  maxFilters: 32
  maxSorts: 8
  maxInputRows: 100000
  maxIntermediateRows: 500000
  maxResultRows: 50000
  maxResultCells: 1000000
  maxTitleBytes: 4096
  maxNameBytes: 256
```

`maxIntermediateRows` is the important one: it bounds the joined row set before
aggregation, which is the only place this capability can realistically explode.
Exceeding any run limit is a data error, not a truncation — a silently truncated
chart is worse than a failed one.

## Endpoints and jobs

Two exact paths, matching the command/query shape used by Document, Comments,
Persona, and Templates.

| Method and path | Queue | Body | Success |
| --- | --- | --- | --- |
| `POST /structured-analyses/command` | serial | `{ type, input }` | `201` created, `200` updated, `200` deleted/purged |
| `POST /structured-analyses/query` | concurrent | `{ type, … }` | `200` |

**Why serial for commands.** Create reads `countLive()` then inserts, and update
and delete read-then-write across a CAS plus a history insert. The store cannot
enforce the catalog limit on its own, which is the house rule for choosing the
serial queue.

**Why concurrent for queries, including `data`.** It performs no writes. It is
Promise-concurrent but runs its transformations on the Node.js thread; the
configured row and cell limits keep that bounded. A worker-thread design should
only be considered if measurement shows it is needed.

All jobs are inline. There are no internal stages, deferred jobs, recovery jobs,
or scheduled work beyond the shared retention sweep.

## Errors

The runtime throws typed errors; endpoint wiring maps them:

| Condition | HTTP | Wire code |
| --- | --- | --- |
| malformed payload or structurally invalid definition | 400 | `validation_error` |
| catalog limit reached | 400 | `catalog_limit_exceeded` |
| analysis absent or deleted | 404 | `not_found` |
| purge on an analysis that still exists | 409 | `not_deleted` |
| stale `expectedRevision` | 409 | `revision_conflict` |
| input name missing, unresolved, non-tabular, bad field, incompatible join/filter/aggregate/graph, or a run limit exceeded | 422 | `analysis_data_invalid` |
| unexpected failure | 500 | `internal_error` |

422 mirrors how Structured Data already reports a name that will not resolve
(`resolution_error` carrying a typed issue): the request was well-formed and the
saved definition is structurally valid, but the project data cannot satisfy it
right now. The body carries which input name failed and why, so an author can
act on it.

There is no 503. The Formula resolver has no "unavailable" state — individual
entries fail into typed issues, and an outright snapshot failure is an
exception, which is a 500.

The 500 body is a fixed generic message; wiring logs the real one.

## Logging

Every path uses the injected `Logger`; no file uses `console`.

```text
structured-analysis.endpoints.registered  info
structured-analysis.create                info
structured-analysis.update                info
structured-analysis.delete                info
structured-analysis.purge                 info
structured-analysis.get                   debug
structured-analysis.list                  debug
structured-analysis.data                  info
structured-analysis.*.rejected            warn
structured-analysis.*.failed              error
```

Command events carry analysis ID, revision, input/join/placement/filter/sort
counts, graph kind, and duration. `data` additionally carries total input rows,
peak intermediate rows, result rows and fields, and total duration.

Logs never contain titles, descriptions, input names, field names, filter
values, source rows, or result rows. Wiring adds the request ID to rejection and
failure events.
