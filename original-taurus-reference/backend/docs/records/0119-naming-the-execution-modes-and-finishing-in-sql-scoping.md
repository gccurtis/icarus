# 0119 — Naming the execution modes, and finishing in-SQL project scoping

Two corrections that came out of reading the register with the product owner, plus
the closure of two entries that were mislabelled as unfinished.

## The dispatch layer was claiming a job system it does not have

The register described "three execution modes, one real queue" as a **vocabulary**
problem — people saying "two job queues" when the code did something else. Read
again with the intended design in hand, it is the other way round: the *code* had
drifted, and its own comments were the evidence. `dispatchSync` was documented as
*"the 'concurrent' execution mode"* and `dispatchAsync` as *"the 'deferred'
execution mode"* — the vocabulary of a queue-based job system, attached to
identifiers that name something else.

Worse, `sync`/`async` names the wrong axis entirely. Whether the response is
synchronous is not what separates these; a handler can run on its own goroutine
and still answer `202`. What actually separates them is **where the work lives and
how long it survives**:

| Mode | Work lives on | Outlives the request? | Outlives the process? |
|---|---|---|---|
| concurrent | the request goroutine | no | no |
| serial | the request goroutine, ordered per key | no | no |
| deferred | a row in the database | yes | yes |

That table explains why there is exactly **one** queue and why it must be durable.
Deferred exists because resolving a prompt block is a model call, then retrieval,
then a second model call — far too long to hold a request open, and work that must
be *retried* rather than lost if the process dies mid-run. Durability is the
point; the `202` is a consequence.

Renamed accordingly (138 usages, one file):

| Was | Now |
|---|---|
| `syncType` | `executionMode` |
| `dispatchSync` | `dispatchConcurrent` |
| `dispatchAsync` | `dispatchDeferred` |
| `operationSync` | `operationMode` |
| `asyncSpec` | `deferredSpec` |
| `adaptAsync` | `adaptDeferred` |

`dispatchSerial` and `dispatchScoped` keep their names — both were already
accurate.

### And the concurrent path stays a path, not a queue

Recorded in the same doc comment, because it is the question the names invited:
concurrent and serial are **request paths**. Go's goroutine-per-request supplies
the concurrency, and SQLite's bounded connection pool supplies the natural
backpressure — a burst does not pile up unbounded, it blocks at the pool. Since a
cell serves a single user working through one project, putting a scheduler in
front of that would cost latency on every request to buy a bound the workload does
not need. The serial mutex, meanwhile, already gives the per-document ordering a
serial queue would, and remains a contention optimisation rather than the
correctness boundary — the store's revision CAS is that.

## DEF-1 finished: four more reads scoped in SQL

Record 0115 made `file.Meta`/`file.Content` filter by project in SQL. That left
every other by-id read trusting its caller, which preserved exactly the ambiguity
the change existed to remove — a reader of the store could not tell which reads
were safe.

`DocumentByID`, `CommentByID`, `ChatByID` and `ChatAttachmentByID` now take a
`projectID` and filter with `WHERE id = ? AND project_id = ?`, returning the
owning capability's not-found error. Ports, in-memory stores and ~25 call sites
follow. `EXPLAIN QUERY PLAN` confirms all four still search by primary key with no
scan — the extra predicate is free.

**The capability-layer `ProjectID` comparisons stay.** They are now deliberately
redundant with the SQL filter: one layer covers a store that does not scope, the
other covers a caller that forgets to check. Neither is load-bearing alone, and
removing either as "now unnecessary" would be a mistake.

One behavioural note: a cross-project chat read now surfaces as `chat.ErrNotFound`
rather than `ErrProjectScope`, because SQL answers first. `chatErr` already maps
both to 404, so the HTTP contract is unchanged.

### `TaskByID` was deliberately left unscoped

`Workflows.RunJob` loads a task precisely in order to *derive* its scope — that is
what makes it impossible for a queue payload to redirect execution into another
project. The `jobs` table has no `project_id`, and `RunPayload` deliberately
carries none. Threading a project id into `TaskByID` would either weaken that
property or require a second, unscoped lookup to exist alongside it. That is a
design question, not a mechanical change, so it stays as it is with the reasoning
recorded here.

## Two entries closed that were only mislabelled

- **PRIV-3** was showing as partly-done on the strength of "job-id auth open". It
  is not open: jobs moved to `/dev` as observability (0117) and the `jobs` table
  has no owner column, so there is nothing to authorize against. Tying status to
  an owner would mean modelling a multi-tenant concern a single-user cell does not
  have.
- **PERF-3** was showing partly-done for the 1s job poll, which is an accepted
  decision (two idle `SELECT`s per second, and nothing needs the latency), not
  pending work. Marking a decision as unfinished makes the register lie about how
  much is left.
