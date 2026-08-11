# dispatch.go

How an operation is executed once it is past the gate. The route table in
`routes.go` names an *operation* (`"documents.append_changes"`,
`"resources.list"`); this file decides what actually happens when that route is
hit, and holds the adapters that carry each decision out.

There are three execution modes:

- **sync** — run the handler inline on the request's own goroutine and answer
  synchronously. This is the concurrent mode: Go already gives a goroutine per
  request, so independent requests run in parallel with no extra machinery.
- **async** — turn the request into a job, enqueue it, answer `202` with a job
  id, and let the client poll `/dev/jobs/:jobID`. This is the deferred mode, for
  work that is too slow or too inference-heavy to hold a request open.
- **serial** — run inline and answer synchronously, but first take a per-key lock
  derived from the request. Requests sharing a key run one at a time; different
  keys run in parallel.

**The table is the whole inventory.** Every access-scoped route — all 136 of
them — is installed through `dispatchScoped`, and `dispatchScoped` refuses an
operation the table does not classify. So "which operations are concurrent,
serial, or deferred?" is answered by reading `operationMode`, not by reading the
table *plus* every bare adapter call site (the JOB-2 gap, now closed).

**The tables must agree.** The mode lives in `operationMode`, the serial key
function lives in `operationSerialKey`, and `dispatchScoped` panics at startup on
any mismatch between them, on an unclassified or twice-registered operation, or
on a mode missing the argument it needs. Every panic in this file fires while
`New` is building the Echo instance — never on a live request — so a wiring
mistake is a failed build or a failed test, not a runtime surprise.

## Code breakdown

### `executionMode` and the mode constants

`executionMode` is an unexported int enum with three values: `dispatchConcurrent`
(the zero value, and the mode of the overwhelming majority of the surface),
`dispatchDeferred`, and `dispatchSerial`.

The axis these sit on is **not** whether the response is synchronous — it is
where the work lives and how long it survives:

| Mode | Work lives on | Outlives the request? | Outlives the process? |
|---|---|---|---|
| `dispatchConcurrent` | the request goroutine | no | no |
| `dispatchSerial` | the request goroutine, ordered per key | no | no |
| `dispatchDeferred` | a row in the database | yes | yes |

That is why there is exactly **one** queue. Concurrent and serial are request
*paths*, not queues: Go's goroutine-per-request supplies the concurrency, and
SQLite's bounded connection pool supplies the natural backpressure. Since a cell
serves a single user, putting a scheduler in front of that would cost latency on
every request to buy a bound the workload does not need.

Two constant-level notes carry real weight:

- **`dispatchDeferred` exists for durability, not for the 202.** Resolving a
  prompt block is a model call, then retrieval, then a second model call — far too
  long to hold a request open, and work that must be *retried* rather than lost if
  the process dies mid-run. The durable row is the point; answering `202` is a
  consequence.
- **`dispatchSerial` is general, not document-specific.** It is the mode for any
  operation that must not interleave with itself — typically a write against one
  resource. `operationSerialKey` maps an operation to an arbitrary
  `func(endpoint.Request) string`, so the key can be any path param, body field or
  composite. Document writes are simply the only operations that need it *today*;
  a spreadsheet or slide write registers exactly the same way, keyed by its own
  id, with one entry in each of the two tables. Nothing about the mechanism
  assumes documents.
- **`dispatchSerial` is a contention optimisation, not the correctness
  boundary.** Serial ops serialize *within a process*; the store's
  revision-checked append is what actually orders writes, including across
  processes. Removing the lock would cost wasted conflict/rebase cycles, not
  correctness.

### `operationMode` — the complete operation → execution-mode inventory

A hardcoded `map[string]executionMode` with one entry per access-scoped route,
grouped by capability and commented group by group (identity, jobs, projects,
organizations, intelligence, names, presence/activity, resources, connectors and
contexts, documents, references and comments, files, agent and chats, workspace
and personas, knowledge). The rule it encodes: reads and mutations that carry a
*synchronous contract* — a returned body, an immediate `409` on a revision
conflict — are sync, and background maintenance is async. In practice the surface
is overwhelmingly concurrent: `documents.append_changes`, `documents.undo`, and
`documents.redo` are the only `dispatchSerial` entries, and `documents.rebase`
and `documents.resolve` the only `dispatchDeferred` ones. Everything else is
`dispatchConcurrent`.

Names are `<capability>.<verb>`, where the verb is the handler method in
snake_case (`resources.patch_access`, `chats.post_turn`, `projects.set_member_role`),
sub-namespaced where the method name alone would be ambiguous
(`documents.history.list`, `agent.tasks.list`, `agent.plans.accept`).

Keeping this as a table rather than a per-route decision is what lets
`dispatchScoped` cross-check the wiring: the route says which operation it is,
the map says how it runs, and disagreement is detectable. Because the map is now
exhaustive, it is also the artefact to read (or diff) when reasoning about the
concurrency of the whole HTTP surface.

### `operationSerialKey` — the key function for every serial operation

A `map[string]func(endpoint.Request) string` holding one entry per operation
classified `dispatchSerial`. The invariant is bidirectional: a serial operation
*must* have an entry here, and *only* serial operations may. All three current
entries key by `documentID`, so concurrent edits to one document serialize while
edits to different documents proceed in parallel.

### `serialKeyByParam` — build a key function from a path parameter

A one-line constructor returning `func(r endpoint.Request) string { return
r.Param(name) }`. It exists so the table above reads as data rather than as three
copies of the same closure.

### `deferredSpec` — how an async operation becomes a job

Three fields: the `jobType` to enqueue, an `authorized` predicate over the
resolved `access.Context`, and a `payload` function building the job's arguments
from that context plus the request. The route table supplies one of these inline
for each async route (see the resolve and rebase routes in `routes.go`), so the
job's shape is stated next to the URL that creates it.

### `adaptSerialScoped` — the serial mode's adapter

Reads the `access.Context` off the Echo context, builds the neutral request,
takes the lock for that request's key, and defers the unlock around the handler
call:

```go
unlock := s.serial.Lock(key(req))
defer unlock()
return writeResponse(c, h(ctx, req))
```

The lock is held across the handler *and* the response write. `s.serial` is the
`dispatch.KeyedMutex` on the `server` struct, so all serial routes share one lock
table.

### `dispatchScoped` — pick the mode, and refuse to be inconsistent

The function every scoped route calls. It enforces three invariants before
choosing a mode, and together they are what make `operationMode` trustworthy
rather than advisory:

1. **classified** — an operation absent from `operationMode` panics. This is the
   guard that keeps the table exhaustive: a route added without a table entry, or
   a typo in an operation name, cannot quietly fall through to the sync default.
2. **installed once** — the `registered` set on the `server` records each
   operation as it is installed and panics on a second use, so one name means one
   route. Registration happens on one goroutine while `New` builds the table, so
   the set needs no lock (noted in the code, since a map on a shared struct
   otherwise invites the question).
3. **coherent with its mode** — a serial key on a non-serial operation, an async
   route without an `deferredSpec`, a sync or serial route without a handler, or a
   serial operation without a key function each panic with a message naming the
   operation.

### `adaptDeferred` — authorize, enqueue, answer 202

Runs the spec's `authorized` predicate first and returns `403 not permitted` if
it fails. Then enqueues `spec.jobType` with `spec.payload(ctx, buildRequest(c))`
on the *request's* context, so a client disconnect cancels the enqueue. A failed
enqueue is a `500`; success is `202` with `{"jobId", "status"}` — the id the
client polls at `/dev/jobs/:jobID`, whose handler is registered in `routes.go`.

### `knowledge.sources` is classified concurrent

The name-to-id listing added beside the other dev lattice routes is a pure read
of already-committed state, so it joins its neighbours as `dispatchConcurrent`.

Classifying it is not optional: `TestDispatchTableIsExhaustive` fails on any
route whose operation has no entry here. That is deliberate — an unclassified
operation would otherwise pick up a default, and the wrong default on a *write*
is a silent concurrency bug rather than a build failure.

### `connectors.files` is classified concurrent

A read of already-committed state, so it joins the other connector reads as
`dispatchConcurrent`.

The classification is not optional in either direction: `TestDispatchTableIsExhaustive`
fails on a route whose operation has no entry here **and** on an entry no route
installs. The second half caught a stale entry left behind when this listing
moved from knowledge to the connector — a table that only checked one direction
would have kept it silently.
