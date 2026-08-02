# Analytic Output — operations

## Runtime

```ts
interface CreateAnalyticOutputRequest {
  readonly title: string;
  readonly description?: string;
  readonly definition: AnalyticDefinition;
}

interface UpdateAnalyticOutputRequest {
  readonly expectedRevision: number;
  readonly title: string;
  readonly description?: string;
  /** Complete replacement, not a patch. */
  readonly definition: AnalyticDefinition;
}

interface AnalyticOutputRuntime {
  create(request: CreateAnalyticOutputRequest): Promise<AnalyticOutput>;
  update(
    id: string,
    request: UpdateAnalyticOutputRequest
  ): Promise<AnalyticOutput>;
  get(id: string): Promise<AnalyticOutput | null>;
  list(): Promise<readonly AnalyticOutput[]>;
  delete(id: string, expectedRevision: number): Promise<void>;
  data(id: string): Promise<AnalyticData>;
}
```

Create and update perform structural validation only. They verify nonempty and
unique IDs, the ordered join shape, field references, filter value shapes,
sort targets, enums, strings, and positive limits. They do not require the
referenced project data to exist at save time. A definition remains editable
while its source is temporarily unavailable or being changed.

Update replaces title, description, and definition as one authored record under
the expected revision. There is no field-by-field patch language.

## Producing data

`data(id)` is read-only:

```text
read the live AnalyticOutput once
  → collect its binding IDs
  → resolve all bindings from one Formula snapshot
  → normalize the inputs
  → joins → filters → projection/aggregation → sorts → limit
  → return AnalyticData tagged with the output revision used
```

The call neither updates the output nor stores the result. Repeating it simply
reads current project data and calculates again. It needs no idempotency key,
settlement step, or background job.

If an authored update or deletion occurs after the initial output read, the
calculation may finish for the already captured definition. Its
`outputRevision` tells the caller exactly which saved revision was used. There
is no current-result pointer to race over.

The runtime uses the existing Formula limits for practical bounds:

- `maxRows` limits each normalized input, intermediate joined rows, and result
  rows;
- `maxFields` limits source and selected result fields;
- `maxOutputBytes` limits the encoded response data; and
- `maxIntegerBits` bounds exact aggregate arithmetic.

No new Analytic Output configuration section is needed initially.

## Endpoints and jobs

The transport registers six exact paths; it does not support path parameters.

| Method and path | Queue | Request | Success |
| --- | --- | --- | --- |
| `POST /analytic-outputs/create` | serial | `{ title, description?, definition }` | `201`, output |
| `POST /analytic-outputs/update` | serial | `{ id, expectedRevision, title, description?, definition }` | `200`, output |
| `GET /analytic-outputs/get?id=…` | concurrent | query | `200`, output |
| `GET /analytic-outputs/list` | concurrent | none | `200`, `{ records }` |
| `DELETE /analytic-outputs/delete?id=…&expectedRevision=…` | serial | query | `204` |
| `POST /analytic-outputs/data` | concurrent | `{ id }` | `200`, `AnalyticData` |

All jobs are inline. “Serial” is only ordinary mutation admission through the
existing job runtime; there are no internal stages, deferred jobs, recovery
jobs, or scheduled work.

The `data` job is Promise-concurrent but executes its pure transformations on
the Node.js thread. Formula's existing row and output bounds keep the first
implementation bounded. A worker-thread design should be considered only if
measurements show it is needed.

## Errors

The runtime throws typed errors and endpoint wiring maps them:

| Condition | HTTP | Wire code |
| --- | --- | --- |
| malformed request or structurally invalid definition | 400 | `analytic_invalid` |
| output absent or deleted | 404 | `analytic_output_not_found` |
| stale expected revision | 409 | `analytic_revision_conflict` |
| binding absent/unresolved, non-tabular input, missing field, incompatible join/filter/aggregate/graph, or data limit | 422 | `analytic_data_invalid` |
| Formula resolver unavailable | 503 | `analytic_data_unavailable` |
| unexpected failure | 500 | `internal_error` |

Data errors are returned directly from the run. They do not create a diagnostic
record. The 500 response contains a generic message; endpoint wiring logs the
actual unexpected error.

## Logging

Every path uses the injected repository `Logger`; no implementation file uses
`console`.

```text
analytic-output.runtime.created       info
analytic-output.endpoints.registered  info
analytic-output.create                info
analytic-output.update                info
analytic-output.delete                info
analytic-output.get                   debug
analytic-output.list                  debug
analytic-output.data                  info
analytic-output.*.rejected            warn
analytic-output.*.failed              error
```

CRUD events include output ID, revision, input/join/shelf/filter/sort counts,
graph kind, and duration. `data` additionally includes total input rows,
intermediate peak rows, result rows/fields, and total duration. Wiring adds the
request ID to rejection and failure events.

Logs do not include titles, descriptions, binding display names, field names,
filter values, source rows, result rows, or whole request/error objects.
