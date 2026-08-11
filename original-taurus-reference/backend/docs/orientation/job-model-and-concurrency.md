# Orientation: document concurrency + the job/execution model

Read this first if you're picking up the **execution-model / concurrency** work.
It captures a root-cause investigation and an agreed design direction so they
survive a context reset. The actionable steps are in
[`docs/superpowers/plans/2026-07-26-document-concurrency-and-job-model.md`](../superpowers/plans/2026-07-26-document-concurrency-and-job-model.md).

## Where the live-document program stands

This work is a detour off the "live document" program (design:
[`docs/superpowers/specs/2026-07-26-live-document-connectors-design.md`](../superpowers/specs/2026-07-26-live-document-connectors-design.md)).
Program status:

- **Slice A** — connector resource kind — **done** (record 0088).
- **Slice B** — connector sync + external watcher + central cost telemetry — **done** (record 0089; `cmd/connector-watcher`, `core/platform/telemetry`).
- **Slice C** — source-scoped retrieval (`knowledge.RetrieveScopedMany`) — **done** (record 0090).
- **Slice D** — resource-backed context variables (`ContextVariable.BoundResource`) — **done** (record 0091). `main` is green here.
- **Slices E–I** — per-block context selection, reference graph, system-driven refresh, agent prompt tools, end-to-end demo — **pending** (plans exist in `docs/superpowers/plans/2026-07-26-*.md`).

The concurrency/job work below was triggered while running Slice D's `-race`
check. It does not block Slice E, but the team chose to resolve it (and design the
execution model) before continuing.

## The data race — root cause (so it isn't re-derived)

Symptom: `go test -race ./core/capability/document/` fails in
`TestConcurrentExactRevisionAdmission` (two users submit at revision 0).

Two facts combine:

1. **The in-memory store hands out shared state.** `document.MemoryStore.DocumentByID`/`DocumentsByProject` return the `Document` **by value** — which copies the `Base.Rows` slice *header* but shares its backing array. Two concurrent loads (and the stored copy) point at the same rows.
2. **The submit path writes what it loaded.** `submitChangesAt` calls `normalizeStoredBase(&doc.Base, …)` — an **in-place** write of row track weights — before applying operations. One goroutine writes those rows while another clones them (`cloneBase`). Same memory, one writer, no lock → race.

Key clarifications that resolved confusion:

- **"Synchronous" ≠ "one at a time."** `POST /documents/:id/changes` is a synchronous handler (reply inline, no polling), but the server runs each request on its own goroutine — many at once. Two synchronous requests execute in parallel.
- **Production is safe.** The SQLite store rebuilds an independent `Base` from bytes on every load, so each request normalizes its own private copy. The race is a **test-double bug** (the in-memory store), not a production bug. `document.MemoryStore` has no non-test callers.
- **Linearity is already enforced** by the revision-checked append (`AppendChangeSet(expectedRevision)`), not by serializing the processing.

## The agreed fixes

1. **Make the in-memory store hand out independent loads** (copy the Base on read, matching SQLite). Prototyped and confirmed to make `-race` green 5/5. This is the root-cause fix. One test (`TestMoveOperationsPreserveIdentityAndUndo`) relied on the old leak and must be corrected to compare read-back-to-read-back.
2. **Stop mutating on read.** `normalizeStoredBase` should not write the loaded document in place. Safe step: make it a pure function returning a normalized copy. Ideal (gated on a frontend check): treat track weights as **derived**, normalize on demand in layout/pagination only, and stop normalizing on the read path. The catch: dropping read-path normalization changes what `GET /documents` returns (raw vs rescaled tracks) — a frontend-contract decision.

## The execution-model design (agreed direction)

The goal is a **central dispatcher**: each request is wrapped at wiring time into a
lambda over its injected dependencies, tagged with an **execution mode** and a
**response mode**. This mostly already exists — handlers are those lambdas — and
should be formalized, not rebuilt from scratch.

**Corrected model — three execution modes, not "two queues":**

- **Concurrent → run inline** on the request goroutine. Do *not* route fast synchronous work through a worker pool: Go already gives per-request concurrency, and a pool would cap throughput and add latency + a result-bridge.
- **Serial → per-key lock/lane** keyed by resource id (document). Same document serializes; different documents run in parallel. **Not** a single global serial queue (that would make one user's edit block an unrelated user's edit).
- **Deferred → the existing job pool** (`core/platform/job`), for slow work only (`resolve`, `rebase`, connector sync). It is one queue with N concurrent workers; it has **no** serial lane and **no** per-key serialization today.

**Response mode** (immediate vs "here's a key, poll later") is a **separate axis**,
declared per request at wiring time, independent of execution mode. The capability
function stays ignorant of request dynamics.

**Open decision:** document writes can get their linear record either from the
existing **optimistic** revision-checked append (parallel process, serialized
commit, loser rebases) or from **pessimistic** per-key serial execution. Pick one;
don't run both half-way. The plan's Part 3 spec task settles this.

## Status of this work (done)

The plan is implemented and committed on `main`:

- **Part 1 — store isolation** (record 0092): `cloneStoredBase` + copy-on-load in
  the in-memory store; the leak-dependent test corrected. `-race` clean 5/5.
- **Part 2(b) — non-mutating normalization** (record 0093): `normalizeStoredBase`
  is now pure (clones, returns; no in-place write). No contract change.
- **Part 3 — execution model** (spec `2026-07-26-execution-model-design.md`;
  record 0094): `dispatch.KeyedMutex` primitive; a `dispatchSerial` execution
  mode on the existing dispatcher; document writes (append/undo/redo) serialize
  by document id. The revision-checked append stays the cross-process source of
  truth — the serial lane is an in-process contention optimization.

## What could come next

- **Part 2(a)** (gated on a frontend check): treat row track weights as fully
  derived — drop read-path normalization entirely and normalize only in layout.
  Changes what `GET /documents` returns (raw tracks), so confirm with the
  frontend first. Its own spec + plan.
- **Response-mode axis:** the spec models response mode (immediate vs deferred)
  as separate from execution mode, but it isn't split out in code yet — today's
  three combinations are covered by the execution mode alone. Split it when an
  operation needs, e.g., serial execution with a deferred response.
- **Resume the live-document program:** Slices **E–I** are still pending (plans in
  `docs/superpowers/plans/2026-07-26-*.md`).
