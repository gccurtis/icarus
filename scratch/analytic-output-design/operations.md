# Analytic Output — operations

## Endpoints

Flat endpoints, matching the sibling small capabilities (Questions,
Hypotheses, Findings, Structured Data). The command/query envelope pair used by
Document and Slide earns its keep when the operation union is large; here there
are seven operations and a discriminated body would only add a decode step.

**No path parameters.** IDs travel in query strings or bodies. The transport
matches endpoints by exact string equality on `` `${method} ${path}` `` — there
is no pattern matching anywhere in the backend.

| Method | Path | Queue | Purpose |
| --- | --- | --- | --- |
| `POST` | `/analytic-outputs/create` | concurrent | Create a definition. |
| `POST` | `/analytic-outputs/update` | concurrent | Patch title, description, or definition under revision CAS. |
| `GET` | `/analytic-outputs/get?id=…` | concurrent | Read one output, optionally with its latest materialization. |
| `GET` | `/analytic-outputs/list` | concurrent | List live outputs, newest-updated first. |
| `DELETE` | `/analytic-outputs/delete` | concurrent | Soft-delete under revision CAS. |
| `POST` | `/analytic-outputs/materialize` | concurrent | Start a materialization; returns the settled result inline. |
| `GET` | `/analytic-outputs/materialization?id=…` | concurrent | Read one immutable materialization by id. |
| `GET` | `/analytic-outputs/materializations?outputId=…` | concurrent | List an output's materializations, newest first. |

> **Note on a sibling design.** `findings-design.md` currently specifies
> `GET /findings/:id` and `DELETE /findings/:id`. Those cannot be registered —
> path parameters do not exist in this transport. Findings will need
> `?id=` forms. Recorded here rather than silently copied.

`create` and `update` are concurrent because the store enforces the invariant
on its own: update is a single compare-and-swap statement returning `false` on
conflict, exactly like `DataStore.update(entry, expectedRevision)`. Serial
queues are for capabilities whose service reads-then-writes across several store
calls.

`materialize` is concurrent for the same reason — its settlement is one
compare-and-publish statement — but it is the one endpoint that does real work,
and it is where the staging below applies.

## Materialization staging

Materialization is one job with three internal phases and two transactions. It
does **not** need three queue hops.

```text
POST /analytic-outputs/materialize { outputId, idempotencyKey? }
  │
  ├─ TRANSACTION 1 · freeze
  │    read output; capture revision + definitionDigest
  │    read the binding through AnalyticInputReader
  │    insert materialization attempt with the frozen input manifest
  │
  ├─ compute (no transaction held)
  │    normalise → filter → project → group/aggregate → sort → limit → validate
  │
  └─ TRANSACTION 2 · publish
       insert the immutable materialization
       advance latestMaterializationId ONLY IF
         output.revision === frozenRevision
       else record as superseded and leave the pointer alone
```

The earlier draft ran this as serial → concurrent → serial with stage receipts.
That is more machinery than the guarantee needs. The recent Derived Outputs
work settled this exact question and landed on the same answer recorded in
`recent-capabilities-fixes-2026-08-01.md`:

> A serial → concurrent → serial queue pipeline would still need a database
> compare-and-swap to be correct across concurrent refreshes and process
> failures.

Since the compare-and-swap is load-bearing either way, the queue hops buy
nothing. A losing materialization is recorded as superseded and returns
`{ published: false }` without changing the current pointer — never an error,
because losing a race is not a failure.

Holding no transaction during compute is what keeps a large aggregation from
blocking every other writer on the SQLite file.

## Idempotency

`materialize` accepts an optional `idempotencyKey`. A replay with the same key
returns the same materialization rather than computing a second one. Without a
key, each call materializes — which is correct, because "recompute this now" is
a legitimate thing to ask for.

`create` does not take a client request id. A duplicate create makes a second
output, which is visible and deletable; the machinery to prevent it costs more
than the mistake.

## Errors

```ts
class AnalyticOutputNotFoundError extends Error { readonly id: string }
class StaleAnalyticOutputError extends Error {
  readonly id: string;
  readonly expectedRevision: number;
  readonly actualRevision: number;
}
class AnalyticInputUnavailableError extends Error {
  readonly bindingId: string;
  readonly reason: "unknown_binding" | "not_serializable" | "resolver_failed";
}
class AnalyticValidationError extends Error {
  readonly field: string;
  readonly reason: string;
}
```

| Error | Status | Wire code |
| --- | --- | --- |
| `AnalyticOutputNotFoundError` | 404 | `analytic_output_not_found` |
| `StaleAnalyticOutputError` | 409 | `revision_conflict` |
| `AnalyticInputUnavailableError` | 400 | `analytic_input_unavailable` |
| `AnalyticValidationError` | 400 | `analytic_invalid` |

Domain throws typed errors; job wiring maps them. Nothing here mentions a
status code.

### Diagnostics are not errors

A materialization that cannot complete — unresolvable field path, view rule
violated, result over the row limit — returns HTTP 200 with
`status: "diagnostic"` and a typed diagnostic list. It is a real, stored,
immutable materialization that happens to carry no rows.

```ts
type AnalyticDiagnostic =
  | { code: "field_path_unresolved"; path: FieldPath }
  | { code: "field_kind_incompatible"; path: FieldPath;
      found: string; requiredBy: AnalyticViewKind }
  | { code: "view_placement_invalid"; view: AnalyticViewKind; reason: string }
  | { code: "aggregation_invalid"; path: FieldPath; aggregation: AnalyticAggregation }
  | { code: "result_rows_exceeded"; limit: number; produced: number }
  | { code: "result_cells_exceeded"; limit: number; produced: number }
  | { code: "input_bytes_exceeded"; limit: number; found: number };
```

Making these errors would mean a chart whose underlying column was renamed
returns a 400 and shows nothing, with no record that anyone tried. As
diagnostics they are inspectable, they persist, and the definition stays
editable.

## Limits

```ts
interface AnalyticLimits {
  maxInputBytes: number;        // default 8_000_000  — frozen wire value
  maxInputRows: number;         // default 200_000
  maxResultRows: number;        // default 20_000
  maxResultCells: number;       // default 200_000
  maxPlacements: number;        // default 24        — across shelves + encodings
  maxFilters: number;           // default 32
  maxSorts: number;             // default 8
  maxFieldPathDepth: number;    // default 8
  maxOutputs: number;           // default 1_000     — live per project
}
```

Input limits are checked at freeze, before compute, so an oversized binding
fails fast without loading a result set. Result limits are checked during
emission and produce a diagnostic rather than a truncated result — a silently
truncated chart is a wrong chart.

## Logging

```text
analytic.create        info   { outputId, view, placementCount, filterCount, durationMs }
analytic.update        info   { outputId, revision, digestChanged, durationMs }
analytic.delete        info   { outputId, revision, durationMs }
analytic.freeze        debug  { outputId, bindingId, ownerRevision, valueDigest,
                                inputBytes, inputRows, durationMs }
analytic.materialize   info   { outputId, materializationId, definitionRevision,
                                published, status, resultRows, resultCells,
                                diagnosticCount, executorVersion, durationMs }
analytic.superseded    info   { outputId, materializationId, frozenRevision,
                                currentRevision }
analytic.get           debug  { outputId, found, durationMs }
analytic.list          debug  { count, durationMs }
```

Titles, descriptions, field names, filter values, and result data never appear
in a log record. Digests, counts, and ids do. `valueDigest` is what makes two
materializations comparable without writing any project data to the log.

`analytic.superseded` is `info` rather than `warn`: losing a publish race is
ordinary and expected whenever someone edits a definition while a
materialization is running.
