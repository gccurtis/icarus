# 0117 — Jobs are observability; the dispatch table is exhaustive

Closes the two **JOB** items from the architecture review
([`issues-and-gaps.md`](../architecture/issues-and-gaps.md)). They are unrelated
in mechanism but both are about the same thing: making a fact about the system
answerable from **one place** instead of by reading every call site.

- **JOB-2** — `operationSync` claimed to be the source of truth for execution
  mode, but only 33 of 135 scoped routes were registered through it.
- **JOB-1** — job status was routed as if jobs were a product feature, and a
  `failed` job was invisible unless you already held its id.

Both changes were written test-first.

## JOB-2 — every scoped route is a named operation

### What changed

All **102** routes that used a bare `s.adaptScoped(handler)` now go through
`s.dispatchScoped("<operation>", handler, nil)`, and each has an explicit
`dispatchSync` entry in `operationSync`. With the two new jobs entries the table
holds **136** operations — exactly one per scoped route, in both directions.

The conversion is behaviour-preserving by construction: every converted route
keeps its method, path, and handler, and `dispatchSync` *is* what
`adaptScoped` did (`dispatchScoped`'s sync branch returns `s.adaptScoped(sync)`).
No route changed execution mode; the serial trio and the two async operations are
untouched.

Names follow what the existing 33 already established: `<capability>.<verb>`,
where the verb is the handler method in snake_case (`resources.patch_access`,
`chats.post_turn`, `projects.set_member_role`), sub-namespaced where the method
name alone is ambiguous — `documents.history.list` was already there, and
`agent.tasks.list` / `agent.plans.accept` follow it, since `agents.List` alone
says nothing about *what* is listed.

### Why the guard had to grow

The old `dispatchScoped` read `operationSync[op]` directly, so an operation
missing from the map got the zero value — `dispatchSync` — silently. That was
tolerable when the map was a small curated list; as the complete inventory it
would mean a typo'd or forgotten entry looks exactly like a correct one. Two
invariants were added, both panicking while `New` builds the route table (so at
process start, never on a live request):

1. **classified** — an operation absent from `operationSync` panics rather than
   defaulting. This is what makes the table exhaustive rather than merely large.
2. **installed once** — a `registered` set on `server` refuses a second route for
   the same operation, so one name means one route and the table can be read as
   an inventory.

### Tests

`core/transport/serial_dispatch_test.go` gains four:

- `TestDispatchTableIsExhaustive` reads `routes.go` and asserts (a) no
  `s.adaptScoped(` call remains in it, (b) every operation a route installs is
  classified, and (c) every classified operation is installed by exactly one
  route. Reading the source is deliberate: the route → operation mapping exists
  nowhere else, and "the table and the route table are the same set" is precisely
  the claim JOB-2 makes.
- `TestOperationNamesFollowOneConvention` holds the naming to
  `<capability>.<verb>` in snake_case.
- `TestDispatchScopedRejectsAnUnclassifiedOperation` and
  `TestDispatchScopedRejectsADuplicateOperation` pin the two new panics.

The existing transport suite still exercises the guard the way it always did:
every test that calls `New` builds the whole route table, so any inconsistency
fails the suite at construction.

## JOB-1 — jobs move to `/dev`, and the queue becomes visible

### The decision

Jobs are **not an external product surface; they are observability**. The
application is scoped per (user, project) — a user signs in, selects a project,
and everything follows from that pair — but the `jobs` table carries **no owner
column at all**: no `user_id`, no `project_id`. That is exactly why job status was
authorized only by possession of the opaque id. A route with no owner and no
per-caller authorization is an operator tool wearing a product URL.

So `GET /jobs/:jobID` became **`GET /dev/jobs/:jobID`**, alongside the other
`/dev/*` routes, still inside the gated (signed-in) group.

### The read that was missing

Polling needs an id. A job that failed while nobody was holding its id was
invisible: no list, no count, no metric. **`GET /dev/jobs`** answers the operator's
actual question:

```json
{"status":"failed","limit":50,"counts":{"queued":0,"running":1,"done":12,"failed":3},"jobs":[…]}
```

`?status=` filters (and must name a real status — a typo is a `400`, not a silent
whole-queue listing); `?limit=` bounds the page, defaulting to 50. `counts` always
carries all four statuses, zeros included, so the summary has a fixed shape and a
client can read `counts.failed` without an existence check. The summary is the
part that makes a *stuck* queue visible, not just a listable one.

Behind it, two methods were added to the `job.Store` port and both
implementations (`sqlite_jobs.go`, `memory.go`):

```go
JobsByStatus(status Status, limit int) ([]Job, error)
JobCounts() (map[Status]int, error)
```

with the page bound stated once in the port as `MaxJobsPage` (200) and
`ClampJobsPage`, applied by both stores. Listing jobs is a debugging affordance,
not a data export, so no caller can pull the whole table however it asks.

### What stays true

`Job.Payload` remains `json:"-"`. It holds internal ids (project, document, block),
and the listing multiplies the exposure — one leak per row instead of per poll —
so a test asserts the payload never crosses the wire, at both the handler and the
HTTP level.

### Tests

- `core/platform/job/job_test.go` — `TestJobsByStatusAndCounts`,
  `TestJobsByStatusIsBounded` (memory store).
- `core/platform/storage/sqlite/sqlite_test.go` — `TestJobsByStatusAndCounts`
  (SQLite: filter, order, limit, and the `GROUP BY` summary).
- `core/handlers/job/job_test.go` (new) — filtering, the fixed-shape summary,
  defaults and bounds, rejection of an unknown status, `[]` rather than `null`,
  and the payload-leak guard.
- `core/transport/transport_test.go` — `TestJobsListingIsDevObservability`, and
  `TestRebaseIsAsyncWithJobStatus` now polls `/dev/jobs/:jobID` and asserts the
  old top-level path is **gone**.

The `dev-test/jobs` suite polls the new path and exercises the listing; the other
suites that poll a job id after a `202` were updated with it.

## Not done here

JOB-1's other half — bringing connector re-sync and the boot-time purge under the
durable queue — is untouched. This record covers the observability half only; the
issue entry stays open for the coverage half.
