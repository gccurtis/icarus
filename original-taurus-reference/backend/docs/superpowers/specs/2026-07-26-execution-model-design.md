# Execution model: a central dispatcher with explicit execution + response modes

**Status:** design (Part 3 of
[`docs/superpowers/plans/2026-07-26-document-concurrency-and-job-model.md`](../plans/2026-07-26-document-concurrency-and-job-model.md)).
Orientation: [`docs/orientation/job-model-and-concurrency.md`](../../orientation/job-model-and-concurrency.md).

**Goal:** Formalize how every request is dispatched — one place that declares, per
operation, *how it executes* (on the request goroutine, under a per-resource lock,
or deferred to the job pool) and *how it responds* (inline, or "here's a job id,
poll later") — without regressing the synchronous edit contract or throughput.

## What already exists (and stays)

The transport layer is already a central dispatcher; we are naming and extending
it, not rebuilding it.

- **`operationSync`** (`core/transport/transport.go`) — a hardcoded
  `map[string]syncType`, the single source of truth for how each operation is
  handled. Today `syncType` has two values: `dispatchSync` (run inline) and
  `dispatchAsync` (enqueue a job, answer 202).
- **`dispatchScoped(op, sync, async)`** reads that map and returns either
  `adaptScoped` (run the handler inline on the request goroutine) or `adaptAsync`
  (enqueue a job from an `asyncSpec`, answer `202 {jobId}`). A wiring/map mismatch
  panics at startup — the map and the routes cannot silently disagree.
- **`core/platform/job`** — one `Queue` + a `Pool` of N concurrent workers
  (default 2) with retry/backoff. Used for `documents.rebase` and
  `documents.resolve`. It has **no** serial lane and **no** per-key serialization.
- **Linearity for document writes** is enforced by the revision-checked append,
  `AppendChangeSet(expectedRevision)`: the first writer at revision N wins; a
  loser gets `ErrRevisionConflict` and rebases. This is independent of how the
  request is dispatched, and (after records 0092/0093) is race-free.

The gap: there is no **serial** execution mode, and execution mode and response
mode are **coupled** (sync ⇒ inline+immediate; async ⇒ deferred+202). You cannot
today say "run this under a per-document lock but still answer inline."

## The model — two orthogonal axes

Every operation declares two things at wiring time:

### 1. Execution mode — *where and under what ordering the handler runs*

- **`Concurrent`** — run inline on the request's own goroutine. **Not a queue** —
  nothing is enqueued; Go's HTTP server already gives a goroutine per request, so
  there is no line to stand in. This is the right, lowest-latency default for
  ~all reads and for independent writes. (Today's `dispatchSync`.)
- **`Serial(keyFn)`** — acquire a per-**key** lock (key derived from the request,
  e.g. the `documentID` path param), then run the handler inline, then release.
  Same key ⇒ strictly serialized; different keys ⇒ fully parallel. This is a new
  mode. It is **not** a single global queue (that would make one user's edit to
  doc X block another user's edit to doc Y).
- **`Deferred`** — enqueue a job on the existing pool and return control; the pool
  runs it later. For slow work the client should not wait on (`rebase`,
  `resolve`, connector sync). (Today's `dispatchAsync`.)

### 2. Response mode — *what the client gets back*

- **`Immediate`** — the handler's result is serialized into the HTTP response
  (200/4xx with a body). Requires an inline execution mode (`Concurrent` or
  `Serial`).
- **`Deferred`** — answer `202 {jobId, status}`; the client polls `/jobs/:jobID`.
  Requires `Deferred` execution.

The axes are *declared* separately even though only three combinations are legal
today (`Concurrent+Immediate`, `Serial+Immediate`, `Deferred+Deferred`). Keeping
them separate is what lets a future operation run `Serial` but answer `Deferred`,
or `Deferred` but with a synchronous ack, without reworking the dispatcher. The
capability handler itself stays ignorant of all of this — it is a plain
`ScopedHandler`; dispatch is a transport concern.

**What is actually encoded today.** Only the *execution* mode is a programmatic
knob — it is the dispatch classification in `operationSync` that decides inline
vs per-key lock vs job pool. The *response* mode is not its own knob yet; today
it is *implied* by the execution mode (inline ⇒ immediate; deferred ⇒
202+poll), because the only combinations we use are the diagonal ones. So
response mode is a **documented lens for reading the code**, not encoded
machinery. It becomes a real second knob only when an off-diagonal case appears
(e.g. a slow agent edit we want to run `Serial` but answer `Deferred`); building
it before then would be speculative. The "async" dispatch feels like one thing
precisely because it currently bundles both axes — background execution *and*
poll-later response.

## The per-key serializer (the one new primitive)

A small keyed lock, in `core/platform/dispatch` (new leaf package, no capability
imports):

```
type KeyedMutex struct { ... }         // map[string]*refcounted-mutex, guarded
func (m *KeyedMutex) Lock(key string) (unlock func())
```

- `Lock("doc-1")` blocks while another holder of `"doc-1"` runs; returns an
  `unlock` closure.
- Different keys never contend.
- Entries are reference-counted and deleted when the last holder releases, so the
  map does not grow without bound across a process's lifetime.

Unit tests: same key serializes (observable via a race-detector-visible shared
counter or ordered log); different keys run concurrently (a barrier both must
reach proves overlap).

This primitive is in-process only. That matters for the decision below.

## Decision: document writes stay optimistic; Serial is a contention optimization

The plan flags an open choice for document writes: keep the **optimistic**
revision-checked append, or move to **pessimistic** per-key serial execution.
Resolution:

**Keep the revision-checked append as the source of truth. Add `Serial(byDocumentID)`
as an in-process optimization layered on top — not a replacement.**

Rationale:

- The per-key lock is **in-process only**. It cannot serialize two app instances
  (or a request and a job worker) writing the same document. Correctness under
  multiple writers *must* come from the store's atomic, revision-checked append;
  that is the only cross-process serialization point we have. Dropping it in
  favor of the lock would be correct on one instance and silently wrong on two.
- Within one instance, `Serial(byDocumentID)` still earns its keep: concurrent
  edits to the *same* document run one at a time instead of racing to append and
  forcing the losers to rebase. Fewer wasted rebases, simpler tail latency, and
  the read-modify-append is never interleaved for a hot document.
- Different documents are unaffected — they hold different keys and run fully in
  parallel.

**PUPP framing (what the lock is really for).** The app runs per-user-per-project:
each (user, project) is its own cell/process. So two *different* users editing the
same document are in *different* processes, and the in-process lock cannot span
them — their edits meet only at the database, where the revision-checked append
decides the winner. The lock therefore does **not** address cross-user editing;
the append does, entirely. What the lock *does* address is concurrency that
originates **inside a single cell**: most importantly the **AI quarterback editing
the document server-side while the same user also edits it** — two goroutines, one
process, one document — plus a user's own multiple tabs and rapid retries. That
intra-cell agent-vs-user collision is a real case in this product, which is why
the lock stays. Cross-user is the append's scope; intra-cell same-process is the
lock's scope; the two do not overlap, so keeping both is not "running both
half-way."

So "don't run both half-way" is honored precisely: the append is authoritative
and unchanged; the lock is a performance/robustness layer that reduces contention
and can be removed without affecting correctness. We are explicitly **not**
weakening the revision check.

## Scope of migration

- `documents.append_changes`, `documents.undo`, `documents.redo` → `Serial(byDocumentID)`,
  response `Immediate`. Key = the `documentID` path param.
- Everything else stays as-is: reads and non-document writes remain `Concurrent`;
  `documents.rebase` / `documents.resolve` remain `Deferred`.
- No change to any capability handler signature, to the HTTP contract, or to the
  job pool.

## Non-goals

- Distributed / cross-instance locking (the revision check covers correctness).
- Routing fast synchronous work through the job pool (a throughput downgrade —
  Go already gives per-request concurrency).
- Priorities, fan-out, or a dependency graph in the job system.
- Changing response bodies or status codes for any existing operation.

## How it maps to plan tasks

- **3.2** — build `dispatch.KeyedMutex` + tests (the new primitive).
- **3.3** — extend the dispatcher: add a `dispatchSerial` mode carrying a `keyFn`;
  generalize `operationSync` (rename to an execution-mode declaration) so each
  operation declares `{execution, response}`; `dispatchScoped` acquires the
  per-key lock for `Serial` then runs inline. Keep the startup mismatch panic.
- **3.4** — declare the three document-write ops as `Serial(byDocumentID)`; verify
  `-race` clean under same-document concurrency and that different-document writes
  still overlap. The revision check stays exactly as-is.

## Acceptance criteria

- A keyed serializer with tests proving same-key serialization and different-key
  concurrency.
- Each route declares its execution + response mode in one place; a wiring/map
  disagreement still panics at startup.
- Concurrent same-document `append_changes` run serialized (no lost rebases from
  interleaving within an instance) and `-race` clean; different-document writes
  run in parallel.
- No capability imports another; the primitive is a transport/platform leaf.
- The synchronous edit contract (`POST /documents/:id/changes` → new revision
  inline) is unchanged.
