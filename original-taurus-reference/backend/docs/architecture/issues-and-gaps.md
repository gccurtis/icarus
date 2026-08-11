# Taurus Omega — Issues, Gaps & Improvements

**Status: living register, audited at the Ω-001 execution baseline
`c0d072556919048b495e729736cf78a7d28e68d3` (2026-07-30).** This is the
companion to [`runtime-model.md`](runtime-model.md): that document describes how
the system is *meant* to run; this one records every place the running code falls
short of it. Each entry names what it is, where it lives, why it matters, its
severity, and the fix.

**Provenance & confidence.** These findings come from a structured read of the
code, not (yet) from reproductions. The correctness and privacy items in
particular should be confirmed with a failing test before they are fixed —
per the repo's TDD practice, the reproduction *is* the confirmation.

**Severity legend.**

| | Meaning |
|---|---|
| **P1 — Critical** | Can corrupt data, lose durable work, or leak across the project boundary. Fix before it bites. |
| **P2 — Important** | Real defect or missing guarantee with a bounded blast radius (intra-project, degraded, or latent). |
| **P3 — Minor** | Coherence, defence-in-depth, efficiency, or maintainability debt. Safe today; fix opportunistically. |

## Summary

| ID | Area | Sev | One-liner |
|---|---|---|---|
| [BUG-1](#bug-1) | Correctness | **P1** | ✅ *Fixed (0109).* `RebaseDocument` drops the revision CAS; concurrent rebase/prune can lose change sets. |
| [BUG-2](#bug-2) | Durability | **P2** | ✅ *Fixed (0110).* No reaper requeues jobs stuck in `running` after a crash — deferred work is silently lost. |
| [BUG-3](#bug-3) | Lifecycle | **P2** | ✅ *Fixed (0110).* The agent task-reaper goroutine has no stop channel; it can hit the store as it closes on shutdown. |
| [PRIV-1](#priv-1) | Privacy | **P2** | ✅ *Fixed (0111).* `GET /documents` skips the AccessScope filter — an excluded member can enumerate restricted docs' metadata. |
| [PRIV-2](#priv-2) | Privacy | **P3** | ✅ *Fixed (0111).* `comment.Reply` skips the per-document access check that Patch/Delete apply. |
| [PRIV-3](#priv-3) | Privacy | **P3** | ✅ *Fixed (0115, 0117).* Request-log redacts secrets but not `email`; `GET /dev/jobs/:jobID` is authorized by possession of the id. |
| [DEF-1](#def-1) | Defence-in-depth | **P3** | ✅ *Fixed (0115, 0119); `TaskByID` scoped-by-design.* The storage layer does no in-SQL project scoping. |
| [DEF-2](#def-2) | Defence-in-depth | **P3** | ✅ *Fixed (0120) — front end must adopt.* CSRF defence rests solely on `SameSite=Lax` (no anti-CSRF token). |
| [DEF-3](#def-3) | Defence-in-depth | **P3** | ✅ *Fixed (0115).* `canWrite(role)` is copy-defined in every handler package instead of once on `access.Role`. |
| [DEF-4](#def-4) | Defence-in-depth | **P3** | ✅ *Fixed (0115, 0166).* Late-bound wiring now has both use-time safety and a final production readiness gate. |
| [PERF-1](#perf-1) | Efficiency | **P2** | ✅ *Fixed (0109).* No index on `documents(project_id)` — every document list is a full-table scan. |
| [PERF-2](#perf-2) | Efficiency | **P3** | ✅ *Fixed (0115); re-serialize accepted as-is.* Redundant duplicate `(document_id, seq)` index; N+1 comment hydration; whole-`base` re-serialize on rebase. |
| [PERF-3](#perf-3) | Efficiency | **P3** | ✅ *Fixed (0115); poll accepted by decision.* Job pickup is a 1s DB poll; `docs.PurgeStale()` runs synchronously on the boot path. |
| [JOB-1](#job-1) | Job system | **P3** | ✅ *Fixed (0117, 0118).* The durable queue carries only 2 op types; connector sync runs outside it; no jobs observability. |
| [JOB-2](#job-2) | Job system | **P3** | ✅ *Fixed (0117).* Only document/resource ops go through `dispatchScoped`; the rest bypass the "source of truth" table. |
| [ING-1](#ing-1) | Ingest | **P1** | ✅ *Fixed (0165).* Exact source and corpus candidate admission counts windows plus nodes in one SQLite transaction. |
| [ING-2](#ing-2) | Ingest | **P1** | ✅ *Fixed (0165).* Actual decoded-byte guards bound unknown, dishonest, growing, and endless streams. |
| [ING-3](#ing-3) | Ingest | **P2** | The fingerprint carries no content for a provider without per-file hashes, so a same-size in-place edit is never detected. |
| [ING-4](#ing-4) | Ingest | **P2** | ✅ *Fixed (0165).* Typed Knowledge limits remain intact through document, connector, and attachment handlers. |
| [ING-5](#ing-5) | Ingest | **P3** | ✅ *Fixed (0167).* Pinned Project/Connector/source/config identities now produce one certified lattice hash across databases. |
| [ING-6](#ing-6) | Ingest | **P3** | ✅ *Fixed (0167).* Active embedding space is generation state; ordinary drift refuses and full re-embed promotes atomically. |
| [COH-1](#coh-1) | Coherence | **P3** | ✅ *Resolved (0114).* The decoupling rule is stated absolutely but `agent` imports `document` for editing — inconsistently. |
| [ORG-1](#org-1) | File org | **P2** | ✅ *Fixed (0112, 0116).* Five God files hide the runtime seams and drive the companion-doc slowness. |
| [ORG-2](#org-2) | File org | **P3** | ✅ *Fixed (0115).* Four files are not `gofmt`-clean; nothing enforces formatting in the repo. |
| [DOC-1](#doc-1) | Documentation | **P2** | ✅ *Fixed (0108, 0113).* The four `architecture/` deep-dives have stale inventories; the runtime model is narrated in three trees. |
| [PROC-1](#proc-1) | Process | **P2** | ✅ *Fixed (0108).* Replace byte-verbatim companion docs with a freshness check. |

---

## Correctness & data integrity

<a id="bug-1"></a>
### BUG-1 — `RebaseDocument` drops the revision CAS · **P1**

> **✅ Fixed in record 0109** — added an `AND base_seq < ?` monotonic guard so a
> stale/duplicate rebase is a no-op; mirrored in the in-memory store; test-first.

**Where.** `sqlite.go:1609-1619` (`RebaseDocument`), racing `PruneChangeSets`
(`sqlite.go:1645`); enabled by `job/pool.go` (`defaultWorkers=2`) and
`service.go:931-935` (rebase enqueue with no dedup).

**What.** Every other write to a document head goes through the airtight
`AppendChangeSet` CAS (`UPDATE ... WHERE id=? AND revision=?`). `RebaseDocument`
is the exception: a blind `UPDATE documents SET base=?, base_seq=? WHERE id=?`
with no `base_seq` guard. `SubmitChanges` enqueues a rebase job whenever pending
≥ threshold, with no dedup, and the pool runs two workers — so two rebase jobs for
the same document can run simultaneously. Reads survive the common case because
pending change sets are retained until pruned. The real hazard is a *stale* rebase
writing an older `base_seq` **after** a newer `PruneChangeSets` (a separate
transaction) has already deleted the intervening change sets: the base is then
folded short with the change sets it still needs gone — unresolvable, lost
content.

**Why it matters.** Silent document corruption / content loss. Low probability
(rebase is deterministic and threshold-gated), but it is the one unguarded write
on the document head, and the headline promise of the persistence layer is that
the head is CAS-protected.

**Fix.** Any of: (a) add a `WHERE base_seq = ?` guard to `RebaseDocument` so a
stale rebase no-ops; (b) fold the prune into the same transaction as the rebase;
(c) dedup rebase enqueues per document. (a) is the smallest and most direct.
Start with a test that drives two concurrent rebases + a prune and asserts no
change set needed by `base_seq` is ever deleted.

<a id="bug-2"></a>
### BUG-2 — Jobs stuck in `running` are never requeued · **P2**

> **✅ Fixed in record 0110** — added `Store.ReapStale`; the pool requeues orphans
> at startup (single-instance crash recovery) and sweeps past a lease.

**Where.** `ClaimDue` (`sqlite.go:1687`) selects only `status='queued'`
(`sqlite.go:1696`); the only stale-reclaimer in the codebase is `ReapStaleTasks`
for the *agent tasks* table (`sqlite.go:2961`), **not** for `jobs`.

**What.** `ClaimDue` moves a job to `running` and bumps its attempt count in one
transaction. If the process dies while a job is `running` (hard crash, OOM,
SIGKILL), that row stays `running` forever — nothing ever re-selects it. Graceful
shutdown is fine (`jobCancel` + `pool.Wait()` lets in-flight jobs finish); the gap
is *ungraceful* termination.

**Why it matters.** A crash mid-`rebase`/mid-`resolve` silently drops that work
with no retry. "Durable jobs" is the system's headline property, and this is the
hole in it.

**Fix.** Add a lease-timeout reaper for the `jobs` table mirroring
`ReapStaleTasks`: on startup and periodically, requeue `running` jobs older than a
lease. Also gives a natural home for a `failed`-job count.

<a id="bug-3"></a>
### BUG-3 — The task-reaper goroutine has no stop channel · **P2**

> **✅ Fixed in record 0110** — `StartReaper` is now context-bound and stopped via
> `jobCtx` on shutdown.

**Where.** `tasks.StartReaper(...)` (`wiring.go:161`) spawns the loop at
`agent/task.go:211-219` — `for range ticker.C` with no context and no stop
channel; `store.Close()` runs via `defer` at `wiring.go:101`.

**What.** Unlike `sessions` (ctx-bound) and the connector detector (`defer`-
stopped), the reaper is never joined to the shutdown path. During the shutdown
window it can call `ReapStaleTasks` on a closing/closed store. The error is
swallowed (`_ =`), but it is a real ordering race and a goroutine leak in tests
that construct and tear down the service repeatedly.

**Why it matters.** Not user-facing today, but it is an unmanaged background
goroutine touching the store during teardown — exactly the class of bug that
turns into a flaky test or a shutdown hang later.

**Fix.** Give the reaper the same lifecycle as the others: pass the job/shutdown
context and return on cancel; join it in `Run()`'s shutdown sequence.

---

## Privacy & access control

<a id="priv-1"></a>
### PRIV-1 — `GET /documents` leaks restricted-document metadata · **P2**

> **✅ Fixed in record 0111** — `GET /documents` filters through an injected
> `canAccess` (the `CanAccessResource` resolver). Note: `revision-hints` and
> `templates` are not yet filtered (they expose only id→revision / shared
> templates — lower sensitivity); fold them in when convenient. The per-document
> filter is an N-check; batching it is a PERF follow-up.

**Where.** `handlers/document/document.go:29-37` → `service.go:233-247`. Contrast
the `/resources` catalog, which filters via `FilterAccessible`
(`resource/resource.go:304-335`).

**What.** Per-document AccessScope (restricting a document to its owner + specific
users/orgs) is enforced by `documentAccessGuard` on routes carrying a
`:documentID`, and by the unified `/resources` catalog. But the plain
`GET /documents` list (and `revision-hints`, `templates`) returns **every**
document in the project — id, name, creatorId, timestamps — with **no** access
filter. A project member excluded from a restricted document can still enumerate
its existence, name, and author, even though opening or editing it by id is
correctly blocked.

**Why it matters.** Metadata confidentiality within a project. Not content, not
cross-project — but it diverges from the `/resources` catalog that *does* filter,
so it is an inconsistency as much as a leak.

**Fix.** Route document listing through the same `FilterAccessible`/
`CanAccessResource` resolver the catalog uses.

<a id="priv-2"></a>
### PRIV-2 — `comment.Reply` skips the per-document access check · **P3**

> **✅ Fixed in record 0111** — `Reply` now calls `authorizeComment`, the same
> guard `Patch`/`Delete` use.

**Where.** `handlers/comment/comment.go:146-161` — omits the `authorizeComment`
check that Patch/Delete apply.

**What.** A write-role member could reply on a comment attached to a document
restricted from them. Cross-project is still blocked (`comment.load` re-scopes by
project); only the intra-project AccessScope narrowing is skipped.

**Fix.** Apply the same `authorizeComment` gate on the reply path. Same class as
PRIV-1; fix together.

<a id="priv-3"></a>
### PRIV-3 — Log email exposure & possession-based job auth · **P3**

> **✅ Closed in records 0115 and 0117** — `email` joins the request-log redaction set (0115). The job half was **answered rather than fixed** (0117): jobs have no owner to tie status to (the `jobs` table has no user or project column), so instead of inventing one, the routes moved to `/dev` and are documented as operator observability. Possession of the unguessable id remains the only authorization, now on a path that says so. There is no further work here — tying status to an owner would mean modelling a multi-tenant concern a single-user cell does not have.

**Where.** `transport/requestlog/requestlog.go` (redaction list); `handlers/job`
(status endpoint).

**What.** Two small ones. (1) The request log recursively redacts
password/token/secret/authorization/api_key but **not `email`** — bodies
containing emails are logged in full. (2) `GET /dev/jobs/:jobID` authorizes any
signed-in user who holds the opaque job id, with no ownership tie (a known
refinement noted in record 0003). Job ids are unguessable, so the practical risk
is low.

**Fix.** Add `email` to the redaction list if request bodies are persisted. The
job half is closed by the `/dev` move: jobs are observability, not a per-caller
resource, so there is no owner to tie them to.

---

## Defence-in-depth

<a id="def-1"></a>
### DEF-1 — No in-SQL project scoping at the storage layer · **P3**

> **✅ Fixed in records 0115 and 0119.** `file.Meta`/`Content` first (0115), then
> `DocumentByID`, `CommentByID`, `ChatByID` and `ChatAttachmentByID` (0119) — all
> now filter `WHERE id = ? AND project_id = ?`, with the capability-layer checks
> kept as a deliberately redundant second layer.
>
> **`TaskByID` is deliberately not scoped**, and that is the design rather than a
> remainder: `Workflows.RunJob` loads a task precisely to *derive* its scope, which
> is what prevents a queued payload redirecting execution into another project. The
> `jobs` table has no `project_id` and `RunPayload` carries none by design.
> Threading an id in would either weaken that property or require a second,
> unscoped lookup to exist beside it.

**Originally partly fixed (0115).** `file.Meta` and `file.Content` now take a project id and
filter on it in SQL (`sqlite_file.go`), returning `file.ErrNotFound` for a foreign
project. The remaining `*ByID(id)` reads below are unchanged.

**Where.** By-id reads such as `DocumentByID(id)`, `CommentByID(id)`, `TaskByID`,
`ChatByID` take no project filter. `file.Content` was the sharpest case — it
returned **raw bytes with no ProjectID**, so it could not self-verify at all.

**What.** The store trusts its callers. Correctness rests entirely on every
capability's `load`/`Get` performing the `record.ProjectID != scope.ProjectID`
check — which today is uniform and correct. But there is no second layer: a
future or mis-scoped caller of any `*ByID(id)` method would return foreign-project
data with nothing to stop it.

**Why it matters.** It is the difference between "safe" and "safe by
construction." The project boundary is the product's core privacy property; it
should not depend solely on every caller remembering a check.

**Fix.** Where practical, carry `projectID` into the by-id queries (as the
already-scoped `ConnectorByID(projectID,id)` / `ContextByID(projectID,id)` methods
do) so the WHERE clause enforces the boundary in SQL.

<a id="def-2"></a>
### DEF-2 — CSRF rests solely on `SameSite=Lax` · **P3**

> **✅ Fixed in record [0120](../records/0120-csrf-double-submit.md).** Deferred at
> first (0115) because it changes the request contract and the client lives in a
> separate repository; the product owner then authorised it. Double-submit cookie:
> the gate issues a non-`HttpOnly` `to_csrf` cookie, and `requireCSRF` requires a
> matching `X-CSRF-Token` header on every authenticated mutation.
>
> **The front end must adopt this** — see
> [`docs/frontend-requests/csrf-token-header.md`](../frontend-requests/csrf-token-header.md).
> Until it does, the cockpit's mutations will 403. Sessions that already exist
> pick up a token on their next request, so no re-login is needed.
>
> The limitation is recorded in the middleware: plain double-submit is defeated by
> an attacker who can write cookies on the domain (e.g. a subdomain), so
> `SameSite=Lax` remains the primary control and this is the second layer.

**What.** All mutations are non-GET and the session cookie is `SameSite=Lax`,
which covers the common CSRF vectors — but there is no anti-CSRF token as a second
layer. Acceptable for the current threat model; note it before exposing the API to
a browser context with looser assumptions.

<a id="def-3"></a>
### DEF-3 — `canWrite(role)` duplicated across handler packages · **P3**

> **✅ Fixed in record 0115** — all nine copies (eight handler packages plus transport) verified byte-identical, then replaced by `access.Role.CanWrite()`.

**What.** The write-permission predicate is copy-defined in transport, comment,
document, name, and others. They agree today, so it is a coherence smell, not a
bug — but a future role change must be edited in N places, and one missed copy is
a silent authorization gap.

**Fix.** Define it once as a method on `access.Role` (e.g. `func (Role) CanWrite()
bool`) and call that everywhere.

<a id="def-4"></a>
### DEF-4 — Late-binding wiring cycles are unguarded · **P3**

> **✅ Fixed in records 0115 and 0166** — an unwired
> `lazyReferenceIndexer` reports an error, and Ω-004 adds a final readiness gate
> for required Resource, Connector, Context, Document, Chat, and Knowledge ports
> before workers or transport start.

**Where.** `wiring.go` — the document↔reference (`lazyReferenceIndexer`
back-patch) and document↔contexts (`docs.UseScopeResolver/UseScopeReferences`)
cycles described in [runtime-model §3](runtime-model.md#3-phase-1--composition-wiringrun).

**What.** These services are deliberately completed with `UseX` setters later in
`Run()`. Every production-required port now exposes `ValidateBoundPorts`, and
`wiring.validateReadiness` checks the whole late-bound graph before the pool,
background work, or listener starts.

**Fix.** Complete: explicit two-phase construction keeps focused test
composition small while making production readiness fail closed.

---

## Efficiency & performance

<a id="perf-1"></a>
### PERF-1 — Missing `documents(project_id)` index · **P2**

> **✅ Fixed in record 0109** — added `idx_documents_project`.

**Where.** `DocumentsByProject` (`sqlite.go:1219`), used by `List`,
`RevisionHints`, and `duplicateName`.

**What.** `WHERE project_id=?` has no supporting index, so every document list,
revision-hint fetch, and duplicate-name check is a full-table scan of the
`documents` table. This grows linearly with project size and is on hot read
paths.

**Fix.** Add `CREATE INDEX idx_documents_project ON documents(project_id)`.
Single-line, high-value.

<a id="perf-2"></a>
### PERF-2 — Redundant index, N+1 hydration, whole-base re-serialize · **P3**

**What.** Three smaller ones. (1) `idx_change_sets_doc_seq` (non-unique) and
`idx_change_sets_doc_revision` (unique) cover the *same* columns
(`sqlite.go:171-172`) — the non-unique one is dead weight. (2) Comment listing
loops `hydrate` per comment, each firing `RepliesByComment` + `AnchorInProject` —
classic N+1 on a thread page. (3) The whole-document `base` blob is re-serialized
on every rebase.

**Fix.** Drop the redundant index; batch comment hydration; (3) is inherent to the
fold model and acceptable — note only.

**Fixed (0115).** (1) The `CREATE INDEX` is gone and a
`DROP INDEX IF EXISTS idx_change_sets_doc_seq` in the declarative schema sheds it
from existing databases. (2) `Store.RepliesByComments` loads every thread on a
page in one `IN` query, and `List` uses it — one reply query instead of N. The
per-comment `AnchorInProject` call stays: it crosses the `AnchorReader` port into
the document capability, so batching it is a port reshape with its own
justification. (3) Left as-is, as noted.

<a id="perf-3"></a>
### PERF-3 — Poll-based job pickup & synchronous boot purge · **P3**

> **🔶 Partly fixed in record 0115** — the trash purge moved off the boot path and now recurs hourly (it previously ran once per process lifetime). The 1s job poll is accepted: it is two idle SELECTs/sec and async latency does not currently matter.

**What.** (1) Each job worker polls the DB every `poll_interval` (default 1s) even
when idle, and an enqueued job waits up to that interval before pickup. Cheap, but
it is polling, not eventing. (2) `docs.PurgeStale()` runs synchronously on the
boot path (`wiring.go:208`) before the server is even constructed — on a large DB
it delays readiness.

**Fix.** (1) Notify-on-enqueue (channel/condvar) if async latency ever matters.
(2) Move trash-purge to a background job (the job system already exists to own it).

---

## The job system

<a id="job-1"></a>
### JOB-1 — Thin coverage & no observability · **P3**

> **🔶 Half-closed in record [0117](../records/0117-jobs-as-observability-and-an-exhaustive-dispatch-table.md)** — the
> product owner's decision: **jobs are observability, not an external product
> surface**. The `jobs` table has no owner column (no `user_id`, no
> `project_id`), which is why status was authorized only by holding the opaque
> id — so status moved to `GET /dev/jobs/:jobID`, and a new `GET /dev/jobs`
> (`?status=`, `?limit=`) lists the queue with a per-status summary, backed by
> `JobsByStatus`/`JobCounts` on the `job.Store` port. A failed job is no longer
> invisible.
>
> **✅ The coverage half is closed too — by deciding it, not by doing it.** Neither
> background loop belongs in the queue:
>
> - **Connector re-sync is reconciliation, not a task.** The detector decides to
>   sync by comparing the source's fingerprint against the stored one, so an
>   interrupted sync simply happens again on the next tick — self-healing without
>   a retry record. A durable job would add machinery and *weaken* the guarantee
>   (a one-shot job that fails past its attempts stops; a reconciler never does).
>   What was genuinely missing was visibility: `DetectChanges` swallowed
>   per-connector errors, so a connector failing every tick was invisible forever.
>   It now returns a `failed` count and the detector logs it.
> - **Trash purge** moved to its own recurring loop for the same reason in
>   [0115](../records/0115-p3-hardening-sweep.md) — a periodic sweep, not a
>   one-shot task.
>
> The queue is for deferrable *work items* with an outcome worth retrying and
> recording (`rebase`, `resolve`, `agent.run`). Periodic reconciliation is a
> different shape, and conflating them would be a downgrade.

**What.** The durable queue we built carries only two op types
(`documents.rebase`, `documents.resolve`) plus `agent.run`. Connector re-sync,
which is conceptually background work, runs on its **own** detector goroutine
outside the queue. And a `failed` job is invisible: there is no jobs-by-status
view, no metric, no audit row — you must already hold the id to query
`GET /dev/jobs/:jobID`.

**Why it matters.** This is *not* "we don't have jobs" — the durable system exists
and is sound (atomic claim, backoff, panic isolation). It is that the system is
under-used and unobservable, so operational problems (a stuck queue, a run of
failures) are silent.

**Fix.** Bring connector sync (and boot-time purge, PERF-3) under the queue; add a
minimal by-status/failed-count view. Pairs naturally with BUG-2's reaper.

<a id="job-2"></a>
### JOB-2 — The dispatch table is only partial · **P3**

> **✅ Fixed in record [0117](../records/0117-jobs-as-observability-and-an-exhaustive-dispatch-table.md)** — all
> 102 bare `adaptScoped` routes now register through `dispatchScoped` with an
> explicit entry, so `operationMode` is the complete inventory of the scoped
> surface (137 operations, one per route). `dispatchScoped` now also panics on an
> unclassified or twice-registered operation, and a test asserts the table and
> the route table are the same set. Response mode is still coupled 1:1 to
> execution mode — left until an operation needs otherwise.

**What.** Only document and resource ops register through `dispatchScoped`; the
rest of the scoped surface (comments, files, agents, chats, personas, workspaces,
sessions) uses a bare `adaptScoped` and never appears in `operationSync`. So
"which ops are concurrent vs serial vs deferred" is not answerable from one place
— it is the table *plus* every bare call site. Also, response mode is currently
coupled 1:1 to execution mode (async always means a 202); a serial op that wanted
a deferred response isn't expressible.

**Fix.** Register every scoped op through `dispatchScoped` (even pure-concurrent
ones) so the table is exhaustive; split response mode from execution mode when the
first op needs it.

---

## Architecture coherence

<a id="coh-1"></a>
### COH-1 — The decoupling rule is stated absolutely but applied inconsistently · **P3**

> **✅ Resolved in record 0114** — `agent` is declared the composition tier, and its one service-level dependency now goes through the agent-owned `DocumentEditor` port.

**What.** The intended invariant "capabilities never import each other" is false
as literally stated: `agent` imports `document`, `intelligence`, `knowledge`,
`notification`, and `persona`. Most of that is shared value types / local ports,
but `Workflows` holds `*document.Documents` and calls `Get`/`SubmitChanges`
*directly* — a genuine service-to-service dependency. The inconsistency is the
tell: wiring goes to the trouble of a `documentAuthorizer` port so `agent` honours
resource *access* without importing `resource`, yet `agent` imports `document`
outright for *editing*.

**Why it matters.** The rule is load-bearing for how the whole codebase stays
legible; a rule that is "true except for agent, and even there only sometimes" is
one people stop trusting.

**Fix (choose the intent).** Either (a) formally bless `agent` as the composition
tier — restate the rule as "leaf capabilities never import each other; `agent`
composes them" and document it — or (b) push the document-editing dependency
behind a port-adapter like the resource one, so `agent` is decoupled uniformly.
(a) is cheaper and matches the code's actual design; (b) is purer. This is a
decision to make, not a defect to silently patch.

---

## File organization

<a id="org-1"></a>
### ORG-1 — God files hide the runtime seams and drive companion churn · **P2**

> **✅ Fixed in records 0112 and 0116.** All five are split, each verified
> behaviour-preserving the same way (line accounting, byte-identical declaration
> set, zero deleted code lines):
>
> | File | Before | After |
> |---|---:|---:|
> | `sqlite.go` | 3915 | 120 (+19 per-capability files) |
> | `document/service.go` | 1161 | 246 (+5) |
> | `knowledge/knowledge.go` | 1066 | 369 (+3) |
> | `wiring/wiring.go` | 930 | 428 (+8 adapter siblings) |
> | `transport/transport.go` | 822 | 133 (+4) |
>
> What remains over 600 lines is large but **genuinely cohesive** — one grammar
> (`formula/syntax.go`), one evaluator (`formula/evaluate.go`), one algorithm
> (`changeset_apply.go`, `rebase.go`), one domain (`document/style.go`,
> `persona.go`), one schema (`sqlite_migrate.go`). Splitting those would fragment
> a single concern, which is the opposite of the goal.

**What.** The directory layout mirrors the runtime spine cleanly, but a handful of
oversized files hide the seams *inside* those directories. Non-test files over
~800 lines:

| Lines | File | Verdict |
|---|---|---|
| 3894 | `platform/storage/sqlite/sqlite.go` | **Split.** A true God object — 35 tables, 184 funcs, ~150 methods on one `Store`, every capability's persistence in one file. The per-capability boundaries the `capability/` tree makes explicit are invisible here. |
| 1161 | `capability/document/service.go` | **Split.** CRUD + anchors + history/undo/redo + prompt + import/export across 37 methods; sub-services can peel off. |
| 1066 | `capability/knowledge/knowledge.go` | Split-ish. Lattice build + membership + retrieval frontier could split build vs. retrieve. |
| 920 | `wiring/wiring.go` | **Finish the split.** Boot DAG + ~8 cross-capability adapters that were never moved to siblings (the split is already half-done). |
| 818 | `transport/transport.go` | **Split.** Route table + three dispatch modes + Echo adapters + the `operationSync`/`operationSerialKey` maps in one file. |

(`formula/syntax.go` 1272, `formula/evaluate.go` 1093, `document/style.go` 919,
and the other 600–730-line files are large but genuinely cohesive — leave them.)

**Why it matters — this is also the companion-doc slowness.** Every non-test
`core/*.go` has a sibling `*.go.md` reproducing its source **verbatim** (140
companions, 45,291 lines, ~1.56 MB). Because the companion mirrors the source,
**churn is proportional to the whole file's size, not the edit's**: changing one
method in `sqlite.go` forces regenerating its **3905-line** twin. The 13 biggest
companions are 35% of all companion mass in 9% of the files. Splitting `sqlite.go`
into ~6 per-domain files cuts per-edit companion churn ~6× and localizes it. The
God-file split and the companion-slowness fix are the same refactor.

**Fix.** Split per the concrete plans (kept in the audit notes):
- `sqlite.go` → ~19 same-package files (`sqlite_migrate.go` — extracting the
  ~530-line `migrate` literal is the single biggest win — then `sqlite_access.go`,
  `sqlite_document.go`, `sqlite_knowledge.go`, … one per domain; shared `Store`,
  no interface churn).
- `wiring.go` → slim to `Run()` + lifecycle; peel adapters into
  `document_prompt.go`, `reference_document.go`, `comment_document.go`,
  `chat_engine.go`, `resource_generator.go`, `intelligence.go`, `tls.go`,
  `config.go` (following the existing `resource_document.go` sibling convention).
- `transport.go` → `routes.go` / `dispatch.go` / `middleware.go` / `response.go`
  (`gate.go` already isolated).
- `document/service.go`, `knowledge/knowledge.go` → split by sub-concern.

This is mechanical and best done **after** PROC-1 lands, so the split doesn't
generate a mountain of verbatim companion churn on the way out.

---

<a id="org-2"></a>

### ORG-2 — Four files are not `gofmt`-clean, and nothing enforces it · **P3**

> **✅ Fixed in record 0115** — the four files are formatted and `scripts/check-format.sh` keeps the tree clean.

**Where.** `gofmt -l core/` reports `capability/agent/ask.go`,
`capability/agent/task.go`, `handlers/agent/agent_test.go`, and
`handlers/persona/persona_test.go`. All four were already unformatted before the
review began (verified against the pre-review baseline), so this is standing
drift, not fallout from recent work.

**What.** The differences are struct-field and composite-literal alignment — the
kind of drift that appears when a field is added by hand and the alignment column
is not re-flowed. Harmless in itself, but it means `gofmt` output is not a
reliable signal: a real formatting mistake would be lost in the noise.

**Why it matters.** The repo has a companion-doc check
(`scripts/check-companions.sh`) but no formatting check, so this can only grow.

**Fix.** Run `gofmt -w` on the four files (each needs its companion touched in
the same change, per the freshness rule), then add a `gofmt -l` assertion — either
to `check-companions.sh` or as a sibling script — so the tree stays clean.

---

## Documentation

<a id="doc-1"></a>
### DOC-1 — Stale inventories & a runtime model narrated three times · **P2**

> **✅ Fixed in records 0108 and 0113.** `runtime-model.md` is canonical and
> `overview.md` is archived (0108). The three remaining deep-dives had their
> inventories rebuilt against the code, and `capabilities/` now mirrors
> `core/capability/` 1:1 with ten new documents (0113). `orientation/` was kept as
> the onboarding path — on reading it, it is not duplicated runtime narrative, so
> it was corrected rather than demoted to an index.

**What.** Two problems. (1) The four `docs/architecture/` deep-dives have accurate
conceptual prose sitting on **stale structural inventories** — the codebase grew
from ~10 to ~20 capabilities and the docs missed almost all of it:

- `overview.md` — says "**Ten** capability packages" (there are 20); omits
  `platform/dispatch`, `platform/telemetry`, and `integration/context/web`.
  *Superseded by [`runtime-model.md`](runtime-model.md).*
- `configuration.md` — documents a **phantom field**
  (`documents.layout.max_row_height_increase`, which does not exist) and omits
  `char_width`, the whole `documents.prompt` block, `trash_retention`,
  `logging.dir`, `agents.web`, `agents.attachments`.
- `transport.md` — never mentions the **serial** dispatch mode or the
  `KeyedMutex`; its `operationSync` sample mislabels the serial ops as sync; the
  route table omits ~30 live routes.
- `persistence.md` — WAL/pragma/CAS prose is accurate and high quality, but the
  "one store, every interface" table lists 9 domains against the real ~19.

(2) The runtime model is narrated in **three** overlapping trees —
`docs/architecture/` (as-built), `docs/reference/architecture/` (aspirational,
legitimately), and `docs/orientation/` (a third partial copy). That is the
confusing duplication.

**Resolution (decided).** `runtime-model.md` is now the single canonical as-built
description. The owner chose *archive `overview.md`, patch the other three*:

- ✅ **`overview.md` archived** to
  [`docs/archive/architecture/overview.md`](../archive/architecture/overview.md);
  its ~10 inbound links were repointed to `runtime-model.md`. **Done.**
- ⏳ **Patch the inventories** of `configuration.md`, `transport.md`,
  `persistence.md` — refresh the stale settings table, `operationSync`/route
  tables (add the serial mode + missing routes), and port/table list, keeping
  their accurate mechanics prose. **Pending.**
- ⏳ Demote `docs/reference/architecture/` to the aspirational *delta* only, and
  `docs/orientation/` to a thin index that links into `architecture/`. **Pending.**
- ⏳ Extend `docs/architecture/capabilities/<cap>/` from the current 10 to all 20,
  one meta-model doc per capability (the per-capability map in
  [runtime-model §6](runtime-model.md#6-phase-4--the-capability-meta-model) is the
  raw material). **Pending.**

---

## Process

<a id="proc-1"></a>
### PROC-1 — Replace byte-verbatim companion docs with a freshness check · **P2**

> **✅ Fixed in record [0108](../records/0108-runtime-model-docs-and-companion-policy.md)**
> — the first increment of this whole effort, and deliberately so: it was
> sequenced ahead of the God-file splits because under the byte-verbatim rule
> those splits would have generated thousands of lines of mirrored churn.
> `scripts/check-companions.sh` enforces the replacement rule, and AGENTS.md
> records it.

**What (the decided change).** Companion `.go.md` docs stay, but drop the
requirement that they reproduce the source **byte-for-byte**. Instead, the
invariant becomes a **freshness check**: a companion's last-modified time must be
**≥** its source file's last-modified time. If you edit the code, the check fails
until you revisit the doc — which is exactly the "you changed the code, update the
doc" ping we want, without forcing a verbatim re-transcription of the whole file
on every one-line change.

**Why it matters.** The verbatim rule is the root cause of ORG-1's companion
slowness: it makes doc churn scale with file size, not edit size, and it is what
makes the God files painful to touch. The freshness check keeps the discipline
(docs never silently fall behind code) at a fraction of the cost, and it makes the
companions *describe* the code rather than *duplicate* it.

**Fix / rollout.**
1. Amend `AGENTS.md`: companion docs describe current state in prose (code
   excerpts allowed where they clarify, but no verbatim-whole-file mandate); the
   binding rule is mtime(`FILE.go.md`) ≥ mtime(`FILE.go`).
2. Add a check script (and/or a pre-commit / CI step) that walks `core/`, and
   fails on any `FILE.go` newer than its `FILE.go.md` (and any `FILE.go` missing
   one).
3. Sequence: land PROC-1 **before** the ORG-1 God-file splits, so the splits don't
   generate a wall of verbatim companion churn.

---

## Suggested remediation order

1. **PROC-1** — change the companion policy first; it unblocks everything else
   cheaply and stops the bleeding on doc churn.
2. **BUG-1, PERF-1** — the P1 correctness fix and the one-line index; small diffs,
   high value, each starts with a failing test.
3. **BUG-2, BUG-3** — close the durability hole and the shutdown race (BUG-2 pairs
   with JOB-1's observability).
4. **PRIV-1/2** — route document listing and comment replies through the access
   filter.
5. **ORG-1** — the God-file splits, now that PROC-1 makes them cheap; `sqlite.go`
   first.
6. **DOC-1** — reconcile the doc trees (pending the archive-vs-patch decision).
7. The remaining **P3** coherence/defence-in-depth items, opportunistically.

---

## Ingest (added 2026-07-30, after the resilient-ingest programme)

Records 0152–0160 hardened the write path. These are what an adversarial review of
that work found and did **not** fix — carried here rather than patched, so nothing
in the register is a fix nobody made.

**Provenance is different from the rest of this document.** These came from a
five-lens review of commits `ef04a11..8311bb2`, and the ones below were kept
because they are argued from the code with a concrete failure attached; several
were *measured*. The verification pass that would rank them formally is separate
work. Read them as strong leads, not as confirmed reproductions — the repo's
practice still applies: the reproduction is the confirmation.

Twelve further findings from the same review **were** fixed, in `815ff7e`,
`06bb31e`, `77cb346`, `9a8f740` and `504c57e`. Two of those are worth knowing
about because they change how much you should trust the entries below: the
capacity check double-counted a re-sync (five independent lenses found it), and a
malformed 200 from a watcher would have pruned an entire connector.

### ING-1 — The artifact projection undercounts by ~2.5x · **P1**

> **Completion owner: Ω-003 — Knowledge capacity and bounded-read safety.**

> **✅ Fixed in record 0165.** `AdmitAndReplaceSources` counts an exact
> source-local candidate (windows plus nodes), subtracts only the generation it
> replaces, and publishes within the same immediate SQLite transaction.
> `AdmitCorpus` makes the same exact check before a deferred corpus tier becomes
> current. Memory and SQLite concurrency tests cover the admission boundary.

**Where.** `checkCapacity` / `ProjectedWindows`, `core/capability/knowledge/artifact_limit.go`.

**What.** `ProjectedWindows` returns a **window** count. `max_artifacts` — and
`ArtifactCounts`, which the check compares against — is **windows plus nodes, at
every tier**. So the pre-flight ceiling weighs one unit against another.

**Measured**, at production geometry (target 4000, overlap 400): 1,015,224 bytes
across four connector sources project to **284 windows** and actually produce
**284 windows + 439 nodes = 723 artifacts**. The projection is 39% of the truth.

**Why it matters.** `max_artifacts` is derived as `memory_budget / 12KiB` precisely
so a corpus rebuild can hold every frontier vector. Admitting 2.5x the ceiling
means the rebuild allocates ~2.5x the budget — which is the OOM kill during the
deferred rebuild that this ceiling was introduced to replace. The check passes, the
sync succeeds, and the *background job* is what dies.

The comment currently in `checkCapacity` claims the windows-only projection
"under-counts, which is the direction to be wrong in". That reasoning was about a
replacement's subtraction and is **wrong at this magnitude** — a 2.5x undercount is
not a conservative estimate, it is a guard that does not guard.

**Fix.** Project artifacts, not windows. The node count is a function of clustering
and cannot be known before the ascent, but it is empirically bounded relative to
the window count and could be estimated from the observed ratio; alternatively
check the ceiling again *after* each slice clusters, when the real count is known,
and abort before the next slice rather than pre-flight. The second is less
elegant and actually correct.

### ING-2 — An absent provider size disables the ceiling entirely · **P1**

> **Completion owner: Ω-003 — Knowledge capacity and bounded-read safety.**

> **✅ Fixed in record 0165.** The streaming reader counts decoded bytes against
> source and run caps, independently of provider metadata, and reads at most one
> byte beyond the remaining allowance to prove refusal. Tests cover zero,
> negative, too-small, growing, and endless claims.

**Where.** `windowContent`, `core/capability/knowledge/build.go`; `checkCapacity`.

**What.** `windowContent` reads to EOF and accumulates every window's text
(~1.1x the file). The only thing between it and a 100GB source is
`checkCapacity`'s projection from `item.Content.Size` — a number that arrives
unverified in the watcher's JSON, that both the `Content` and `FileEntry` contracts
explicitly permit to be `0`, and that makes `checkCapacity` **return nil outright**
when the projection sums to zero.

**Why it matters.** A provider reporting `Size: 0` — which `provider.go` documents
as legal — or a size smaller than the truth, or a file that grows between the
listing and the read, gets `adding == 0` and the pre-flight check admits the batch
unconditionally. Nothing anywhere compares bytes read against the advertised size,
and no cap is applied when the size is absent. `connectors.max_file_bytes` used to
be the backstop here and was deliberately deleted (record 0158) on the grounds that
the artifact ceiling replaced it. For a size-less provider, nothing replaced it.

**Fix.** Bound the read itself rather than trusting a declared number: count bytes
as `windowContent` streams and fail the source past a derived limit. That is the
one check that cannot be lied to. Treating a zero size as "unknown, therefore
unbounded" is the specific inversion to remove — unknown should mean *bounded by
the derived cap*, not exempt from it.

### ING-3 — The fingerprint carries no content for a provider without hashes · **P2**

> **Completion owner: Ω-007 — connector source admission and source integrity.**

**Where.** `FingerprintOf`, `core/capability/connector/provider.go`.

**What.** The snapshot fingerprint hashes `(path, size, hash)` per file. When
`FileEntry.Hash` is empty — which the contract documents as legal, claiming it
"simply means every file is read" — the fingerprint carries **no information about
content at all**, so `SyncIfChanged`'s gate never fires on an in-place edit that
preserves the file's size.

**Why it matters.** The local-folder provider always computes a hash, so this is
latent today. It stops being latent for the next provider: the watcher protocol is
public, and the design's intended sources are cloud services — Google Drive, for
one, returns no checksum for native Docs. Such a provider satisfies the documented
protocol and silently loses change detection for same-size edits.

**Fix.** Either require a hash in the protocol (and make the absence an error
rather than a documented option), or fall back to a modification timestamp in the
fingerprint when the hash is absent. The current contract promises a behaviour it
does not deliver, which is the part to resolve first.

### ING-4 — The artifact-limit refusal never reaches the document caller · **P2**

> **Completion owner: Ω-003 — Knowledge refusal safety.**

> **✅ Fixed in record 0165.** `limit.From` now precedes generic provider error
> mapping for document, connector, and attachment paths. Byte limits answer 413;
> the exact project artifact policy answers 422; both retain non-retryability and
> remediation.

**Where.** `AddDocument` / `embedErr`, `core/handlers/knowledge/knowledge.go`.

**What.** Before record 0165, `artifact_limit.go` built a `limit.Exceeded` with
an explicit `Unwrap`, but `AddDocument` routed every error through an
`embedErr` that recognized only provider/identity failures. The typed artifact
limit therefore fell into the generic failure arm.

**Why it matters.** The message exists to say *what to do*: "ask your administrator
to raise `knowledge.ingest.max_artifacts`". Losing it at the boundary makes a
project at its ceiling look like a broken server. This is the same failure record
0155 fixed across 19 handler packages, reappearing at a new call site — worth
noting as a pattern rather than an incident.

**Fix.** Add a `limit.From` arm to `embedErr`, and check whether the connector-sync
handler has the same gap.

### ING-5 — Cross-database reproducibility stops at the connector id · **P3**

> **Completion owner: Ω-005 — embedding-space lifecycle and certification.**
>
> **✅ Fixed in record 0167.** The deterministic 64-source Connector fixture
> pins Project, Connector, source, embedding, and KLR configuration identities,
> builds two independent databases, and requires the certified lattice hash
> `a103d414…94bac`. Live-provider quality remains intentionally tolerant of
> provider float noise; structural regression is no longer measured through
> randomly minted fixtures.

**Where.** `localRefID` / `windowID`, `core/capability/knowledge/lattice.go`;
record 0160.

**What.** Record 0160 made window and local-ref ids content-derived so that ingest
is reproducible. It is reproducible **for a given (project, connector)** — a wipe
and re-sync of the same connector now produces a byte-identical lattice. It is not
reproducible across *different* projects or connectors, because their ids are
legitimately random: they are user-created resources.

**Observed.** `dev-test/knowledge-scale` builds a fresh project and connector on
every run, so it still varies: 172, 205 and 214 corpus nodes across three runs of
the same 596-file corpus, at thresholds 0.563/0.564/0.563.

**Why it matters.** Not for correctness — each database is internally consistent,
repair works, retrieval works. It matters for debuggability: two fresh runs of the
same corpus cannot be diffed, so a real regression in clustering is hard to
distinguish from ordinary variation. Record 0160's own reproducibility gate is a
unit test with fixed source ids for exactly this reason.

**Fix.** Completed by the pinned no-cost certification fixture. The live scale
suite remains the quality/cost check and reports provider spend.

### ING-6 — A stale untouched source can still split a project's embedding space · **P3**

> **Completion owner: Ω-005 — embedding-space lifecycle and certification.**
>
> **✅ Fixed in record 0167.** Embedding spaces and Text generations are
> explicit Project state. Ordinary ingest resolves one active space and returns
> `knowledge.embedding_space_change_required` on configured drift while exact
> active-space retrieval remains available. Owner-authorized re-embedding
> constructs a checkpointed shadow generation, validates every artifact, and
> changes the active pointer only through an explicit revision/cursor CAS.

**Where.** `syncState.checkIdentity`, `core/capability/knowledge/build.go`.

**What.** Before Ω-005, the identity pin stopped one sync from mixing spaces but
could not see an untouched source. The store now scopes every artifact to an
immutable generation and ordinary writes cannot alter that generation's space.

**Why it matters.** Mixed vector spaces silently destroy score meaning. The new
failure occurs before publication and preserves the last certified generation;
repair remains an explicit, budgeted operator decision.

**Fix.** Completed: preview/start/status/pause/resume/cancel, durable
checkpoints/recovery, catch-up, validation, explicit promotion, and bounded
rollback.
