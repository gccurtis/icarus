# job.go

The HTTP-facing side of the background-jobs system: read one job's status by id,
and list the queue. It is a thin application-layer adapter between the transport
and the core `job` package — it holds no logic of its own beyond shaping a
request into a store call and a store result into a response.

**Jobs are observability, not a product surface.** The `jobs` table carries no
owner: no `user_id`, no `project_id`. The whole application is scoped per (user,
project), but a job belongs to the *process*, which is exactly why job status was
only ever authorized by possession of the opaque id. So both endpoints live under
`/dev` (see `routes.go`), inside the signed-in gate but outside the product
surface, and both expose **only lifecycle fields** — `Job.Payload` is tagged
`json:"-"` in the core package, so internal ids cannot leak through either
endpoint however the job is serialized.

The two endpoints answer different questions. `Get` answers "how is *this* job
doing?", for a client holding the id an async `202` handed it. `List` answers "how
is the queue doing?" — the question nobody could ask before, because a `failed`
job with no known id was invisible.

## Code breakdown

### Package documentation

States both endpoints and the reason they sit on the dev path: no owner column,
so nothing about a job is per-caller; lifecycle fields only, never a payload.

### `DefaultListLimit`

The page size a listing uses when the caller does not ask for one (50). It is the
soft default; the hard cap is `corejob.MaxJobsPage`, which the store enforces
regardless of what this layer passes.

### The `Reader` seam

The narrow interface this package needs from the store — `JobByID`,
`JobsByStatus`, `JobCounts` — rather than the full `job.Store`. The SQLite store
and the in-memory store both satisfy it, and a test fake needs only these three
methods. It is the read-only subset of the queue's port.

### `listStatuses`

The four statuses (`queued`, `running`, `done`, `failed`) in one slice, used
twice: to validate the `?status=` filter, and as the fixed key set of the summary.
Reporting all four — zeros included — is what gives the response a stable shape,
so a caller can read `counts.failed` without checking whether the key exists.

### The `Handlers` type and constructor

`Handlers` bundles the endpoints with the `Reader` they were built against;
`NewHandlers` is what the composition root calls. Returned by value, since it
holds only the interface reference.

### `Get` — status of one job

Reads the `jobID` path parameter and looks it up. Error discrimination is the
whole of it: `corejob.ErrNotFound` (matched with `errors.Is`, so a wrapped
sentinel still counts) becomes `404 job not found`; anything else becomes a `500`
with a deliberately generic message; success is `200` with the job as the body.
The access context is ignored — there is nothing per-caller to check.

### `List` — the observability read

Parses the optional `status` filter and `limit`, asks the store for a page and a
summary, and answers `{status, limit, counts, jobs}`. Three details carry the
intent:

- an unparseable or unknown `status` is a `400`, not a silent "everything" —
  a typo must not read as a successful whole-queue listing;
- `jobs` is normalized to an empty slice when the store returns nil, so the JSON
  is `[]` rather than `null` and a client can iterate unconditionally;
- `counts` is rebuilt over `listStatuses` rather than passed through, filling in
  the statuses the store had no rows for.

Both store calls fail closed to a `500` with their own message, so a broken
listing and a broken count are distinguishable in a log.

### `parseStatus` and `parseLimit`

The two request-shaping helpers. `parseStatus` maps `""` to "any status" and
rejects anything that is not a real status (the `bool` return is the rejection
signal). `parseLimit` resolves the page size: a positive number as asked, capped
at `corejob.MaxJobsPage`; absent, unparseable, or non-positive falls back to
`DefaultListLimit`. Bounding here as well as in the store is deliberate — the
handler's cap is what makes the response predictable, the store's is what makes
it safe.

### `errResp`

Builds the one error shape the package uses, `{"error": msg}` with a status, so
every failure path here looks the same to a client.

### Failures carry their cause

Its 3 failure responses (`could not read job`, and the rest)
go through `endpoint.Fail`, which attaches the error to
`Response.Err` for the request log while the body stays exactly as opaque as it was.
No response shape changed; what changed is that the reason is now recorded instead of
discarded.

See `core/endpoint/endpoint.go.md` for why that field sat unused, and why the
constructor lives there rather than beside each of the seventeen private `errResp`
copies. The `errResp` here remains for the failures that genuinely have no cause to
attach.
