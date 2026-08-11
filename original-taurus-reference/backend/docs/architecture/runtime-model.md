# Taurus Omega — Architecture & Runtime Model

**Status: canonical, as-built.** This document describes the backend *core* as
the code actually runs it, audited at the Ω-001 execution baseline
`c0d072556919048b495e729736cf78a7d28e68d3` (2026-07-30). Where it
disagrees with [`docs/reference/`](../reference/README.md), this document wins:
`reference/` is the aspirational north-star, this is the ground truth. Its
companion, [`issues-and-gaps.md`](issues-and-gaps.md), records where the running
system falls short of this model — read the two together.

The claim this document makes is that Omega has **one coherent runtime spine**,
that the **directory layout mirrors that spine**, and that the code under those
directories follows the same seams. Where that breaks down (a handful of
oversized files that hide the seams), it is called out here and tracked in the
companion.

---

## 1. The runtime model in one picture

### The governing invariant: everything is scoped to (user, project)

This is the first thing to understand about Omega, because every other rule in
this document descends from it:

> **A user signs in before protected work. Project work additionally establishes
> an authorized project; user, organization, and project-directory operations
> remain explicitly outside that execution scope.**

There is no anonymous surface beyond health and the login/register pair, and no
project-less surface beyond account and project management. By the time a request
reaches a capability, both halves of the pair are resolved, re-verified, and
authoritative — the capability is never handed an identity or a project it has to
validate for itself, and never one the client chose.

That is why the control gate ([§4](#4-phase-2--the-control-gate)) is structural
rather than a per-handler check: the tiers *are* the three states a caller can be
in (anonymous, signed in, signed in with a project selected). It is also why
"scoped" appears in nearly every signature in the codebase — a `Scope{ProjectID}`
parameter is that invariant made explicit at the capability boundary.

A running Omega process is a **multi-user modular monolith** over one SQLite
store. Its package boundaries are now executable through
[`ports-and-adapters.md`](ports-and-adapters.md) and `core/architecture`. The
User Cell and per-user Project Subcell registry remains Ω-013 target work, not an
as-built deployment claim; Ω-004 freezes its typed-port and disposable-facade
contract. Membership admits collaborators, so caller identity and project
authorization are re-established per request rather than assumed from process
placement.

### The six-phase spine

Every request travels the same path:

| Phase | Home | What happens |
|---|---|---|
| **0 · Config** | `etc/config.yaml`, `core/platform/config` | Built-in defaults → YAML manifest → local secrets overlay, resolved once into an immutable `config.Config`. |
| **1 · Composition** | `core/main.go` → `core/wiring` | `wiring.Run()` builds every runtime object in dependency order off one root (`sqlite.Store`), wires cross-capability behaviour through adapters, and starts the process lifecycle. |
| **2 · Control gate** | `core/transport`, `core/capability/access` | Echo HTTP edge. Three route tiers — public / gated / project-scoped. The gate resolves the session cookie, re-checks membership on every request, and stamps the *authorized* project onto the request context. |
| **3 · Dispatch & execution** | `core/transport`, `core/platform/{dispatch,job}` | A per-operation table routes each scoped op into one of three execution modes — **concurrent** (inline), **serial** (lock on a per-operation key), or **deferred** (durable job pool). |
| **4 · Capabilities** | `core/capability/*` (21 Go packages) | The domain. Each capability is a service over injected ports; leaf capabilities remain independent and the small composition/type/library import graph is explicit. |
| **5 · Persistence** | `core/platform/storage/sqlite` | One WAL-mode SQLite store behind every persistence port. Document concurrency is an append-only change-set log admitted by a revision compare-and-swap. |

```
                  ┌─────────────────────────────────────────────────────┐
  config.yaml ──▶ │  Phase 0  load + overlay  ──▶  config.Config (immutable) │
                  └─────────────────────────────────────────────────────┘
                                     │
                  ┌──────────────────▼──────────────────┐
                  │  Phase 1  wiring.Run() composition   │
                  │  sqlite.Store ─┬─▶ every capability  │
                  │  intel, queue ─┘   + adapters        │
                  │  validate registries + bound ports   │──▶ transport.New(...)
                  └──────────────────┬──────────────────┘
                                     │
   HTTP ─▶ Recover ─▶ BodyLimit ─▶ Secure ─▶ [requestlog] ─▶ Phase 2 gate
                                     │            (public / requireUser / requireProject)
                                     ▼
                       Phase 3 dispatchScoped(op)
                        ├─ concurrent  → run inline on the request goroutine
                        ├─ serial      → KeyedMutex(documentID) → run inline
                        └─ deferred    → enqueue job → 202 {jobId}; pool runs it later
                                     │
                                     ▼
                       Phase 4 capability service (stateless, ports)
                                     │
                                     ▼
                       Phase 5 sqlite.Store (WAL, revision CAS)
```

Two things people say about this model are imprecise, and the precision matters:

- **"Two job queues" → three execution *modes*, one real queue.** Concurrent work
  runs inline on Go's per-request goroutine (no pool); serial work runs inline
  behind a lock on a key the operation chooses; only *deferred* work goes through the durable job
  pool. See [§4](#4-phase-3--dispatch--execution).
- **"Capabilities never import each other" → *leaf* capabilities remain
  independent; composition/type/library edges are explicit.** 18 of 21 packages
  import no other capability. `agent` is the composition tier,
  `knowledge → intelligence` carries its tool-binding value contract, and
  `formula/names → formula` layers state over the pure evaluator.
  See [§6](#6-phase-4--the-capability-meta-model).

---

## 2. Phase 0 — Configuration

Resolution is a three-layer overlay onto one struct
(`core/platform/config/config.go`, driven by `wiring.loadConfig`):

1. `config.Default()` — built-in defaults. `Mode: prod`, so the built-in default
   is **fail-closed**: prod requires TLS, and `resolveTLS` will `log.Fatal` rather
   than serve plaintext.
2. `config.Load(path)` — YAML unmarshalled *over* the defaults. Path from
   `TAURUS_OMEGA_CONFIG`, else `etc/config.yaml`. A missing file at the *default*
   path warns and continues on defaults; a missing *explicit* path or any parse
   error is fatal.
3. `config.Overlay(path.local)` — a sibling `*.local.yaml` (e.g.
   `etc/config.local.yaml`) overlaid only if it exists. This is where the real
   OpenRouter API key lives; it is gitignored and never committed.

Because each layer is a YAML unmarshal onto the same struct, unset keys keep the
lower layer's value. **Caveat:** YAML replaces sequences and maps rather than
merging them — overriding a *scalar* deep in a map works, but overriding a *list*
(e.g. a cast route table) replaces the whole list. Fine for the intended
"just add my key" use; a footgun otherwise.

Config is **read once and injected**; nothing re-reads it at runtime. Secrets are
never logged (the only intelligence log line is a provider *count*). Settings that
shape the server: `mode`, `server.addr`/`tls`, `logging.{requests,dir}`,
`storage.dsn`, `access.session_ttl`, the `documents.*` block (rebase threshold,
history limit, layout geometry, prompt casts/templates, trash retention),
`jobs.{workers,poll_interval,max_attempts}`, `intelligence.{providers,casts}`,
`knowledge.*`, and `agents.*`.

---

## 3. Phase 1 — Composition (`wiring.Run`)

`core/main.go` is a 3-line shell: `func main() { wiring.Run() }`. Everything
about how the process is assembled and how it lives and dies is in
`wiring.Run()` (`core/wiring/wiring.go`).

### The dependency graph is a single-root DAG

`sqlite.Store` is the universal root — every persistent capability hangs off it.
`intelligence` and the job `queue` are secondary hubs. The whole graph fans into
`transport.New(...)` as the terminal sink. Construction order is topologically
valid: connectors are built before the resources that wrap them; resources before
the workflows that authorize against them; personas before the documents and
workflows that resolve them; the job queue before every service that enqueues.

**Leaf cross-capability behaviour is normally bridged by adapters in
`core/wiring`.** A capability declares a port (an interface for the behaviour it
needs); wiring writes a thin adapter around the owning service. The sanctioned
exceptions are executable in
[`docs/completion/architecture-import-map.tsv`](../completion/architecture-import-map.tsv):
Agent composition, Knowledge's Intelligence port/types, and the Formula name
manager's use of the pure evaluator.

### Two deliberate late-binding cycles

Two genuine construction cycles are broken by late binding, and they are the
fragile part of the boot:

1. **document ↔ reference.** `documents` needs a `ReferenceIndexer`; `references`
   needs `documents` (to resolve display names). Resolved by constructing an empty
   `lazyReferenceIndexer{}`, passing it into `documents`, then back-patching its
   `.refs` field once `references` exists.
2. **document ↔ contexts.** `contexts` needs `resources` (which needs
   `documents`); `documents` needs the contexts scope resolver. Resolved by
   `docs.UseScopeResolver(...)` / `UseScopeReferences(...)` mutating the
   already-constructed `documents` service.

Construction still relies on the setters' topological order, but the Ω-004
readiness gate calls each capability's `ValidateBoundPorts` before any worker or
listener starts. An omitted back-patch is therefore a named startup failure, not
a latent nil path.

Knowledge has two additional late-bound composition ports:
`ReembedAuthorizer` and `ReembedSourceReader`. They close only after Access,
Resource, Document, Connector, Chat, and File exist. The readiness gate also
requires those ports, the generation-capable Store, and the Resource locator.

At boot, `RecoverReembeds` resets interrupted Knowledge domain runs to a
schedulable state and the composition root enqueues each returned run before the
pool starts. The job row is a wakeup; the durable re-embed run/checkpoints and
the SQLite active-generation transaction own correctness.

### Lifecycle

`Run()` recovers queued Knowledge generation migrations, then starts the HTTP
listener, job pool, task reaper, trash purge, connector
detector, and session consumer/sweeper, then blocks on a signal and shuts down
gracefully: `e.Shutdown(10s)` drains HTTP, `jobCancel()` stops the context-bound
loops, `pool.Wait()` drains in-flight jobs, and `sessions.Stop()` joins the
session workers.

---

## 4. Phase 2 — The control gate

The HTTP edge is Echo. Middleware order for a mutation:
`Recover → BodyLimit(1M, 32M for /files) → Secure headers → [requestlog] → tier
gate → per-resource guard → sessionActivity → dispatch`.

### Three tiers, expressed as route groups

- **Public** (root group, no gate): `GET /healthz`, `POST /auth/register`,
  `POST /auth/login` (the last two behind a per-IP rate limiter).
- **Gated** (`requireUser`): a session that resolves to a user. `/auth/{me,logout}`,
  `/dev/jobs/:jobID`, all project management, `/organizations/*`, `/intelligence/*`,
  the `:projectID`-in-path routes.
- **Project-scoped** (`requireProject`): a signed-in user *with a selected
  project*. Everything else — documents, resources, files, comments, connectors,
  contexts, presence, agents, chats, personas, workspace.

### Where the project boundary is established

`access.Resolve(cookie)` reads the opaque `to_session` cookie, loads the session
(lazily deleting it if expired), loads the user, and — only if a project is
selected — loads the project **and re-checks membership**, populating
`ctx.Project`/`ctx.Role` only if both succeed. A deleted project or revoked
membership silently drops to project-less (→ 409), so a stale selection can never
leak. **This check runs on every request; there is no cached grant.**

### The boundary is enforced twice — this is the core privacy property

1. **Transport** stamps the *authorized* `ctx.Project.ID` onto the context.
   Handlers pass only `ctx.Project.ID` to capabilities — never a client-supplied
   project id. (The one route that reads a body `projectId`, `project.Select`,
   re-checks membership inside the capability.)
2. **Each capability re-scopes by project** on every by-id read/write:
   `if record.ProjectID != scope.ProjectID { return ErrNotFound }`. Verified
   uniform across document, file, comment, chat, connector, context, persona,
   workspace, resource, agent.

The audit found **no cross-project leak**: client-supplied project ids are never
trusted on a scoped route, and the two layers are independent. The residual gaps
are all *intra*-project (a member seeing metadata of a document restricted *within*
their project) or defence-in-depth (the storage layer itself does no in-SQL
project scoping — correctness rests entirely on the per-capability check). Those
are `PRIV-1/2` and `DEF-1` in the companion.

Session cookies are `HttpOnly`, `SameSite=Lax`, `Secure` under TLS, opaque and
unsigned (all state server-side, so revocation is immediate). Login is
timing-safe and non-enumerating. Share links are read/edit-only, upgrade-only,
and gated behind a per-project visibility master switch.

---

## 5. Phase 3 — Dispatch & execution

**Every** access-scoped operation — all 137 — is registered through one funnel,
`dispatchScoped(op, syncHandler, asyncSpec)` (`core/transport/dispatch.go`),
which looks the op up in two adjacent package-level tables — `operationMode`
(op → mode) and `operationSerialKey` (op → lock key) — and picks a mode. The
funnel **panics at startup** on any inconsistency (an op absent from
`operationMode`, an op installed on two routes, a serial op with no key, an async
op with no spec, a sync op with no handler), so the tables and wiring cannot
silently drift, and the table is the complete inventory of the scoped surface
rather than a partial index. That build-time guard is a real strength.

| Mode | Mechanism | Concurrency | Used by |
|---|---|---|---|
| **Concurrent** (`dispatchConcurrent`) | Runs the capability handler inline on the request goroutine. No pool, no lock. | Go's goroutine-per-request. | The default — all reads, resource CRUD, most document ops. |
| **Serial** (`dispatchSerial`) | Acquires a lock on a key the operation chooses, from `dispatch.KeyedMutex`, then runs inline and answers synchronously. | One at a time **per key**; different keys run in parallel. | Today: `documents.append_changes`, `documents.undo`, `documents.redo`, keyed by `documentID`. Any operation that must not interleave with itself registers the same way. |
| **Deferred** (`dispatchDeferred`) | Enqueues a durable job, returns `202 {jobId}`; the client polls `GET /dev/jobs/:jobID`. | The job pool (fixed N workers, default 2). | `documents.rebase`, `documents.resolve`. |

`dispatch.KeyedMutex` is a reference-counted map of per-key mutexes (entries are
deleted at zero refs, so a long-lived process never leaks a lock per key seen).
The serial lane is explicitly a **contention optimization** — it reduces wasted
conflict/rebase cycles on a hot document — and is removable without affecting
correctness, because the true cross-process authority is the revision CAS in the
store (see [§7](#7-phase-5--persistence)). Note the lock is **in-process only**;
it does not serialize a request against a job worker mutating the same document.

The **durable job pool** (`core/platform/job`) persists jobs to the SQLite `jobs`
table, claims them atomically in an immediate transaction (no two workers claim
the same row), recovers handler panics into errors, and retries with exponential
backoff up to `max_attempts`. A `queued` job survives process restart. Pickup is
**poll-based** (default 1s), not notified.

The queue is also where **jobs observability** lives: `GET /dev/jobs` lists it by
status with a per-status summary, and `GET /dev/jobs/:jobID` polls one id. Both
sit on the dev path deliberately — the `jobs` table has no user or project
column, so a job belongs to the process, not to a caller.

---

## 6. Phase 4 — The capability meta-model

The capabilities under `core/capability/` are the domain. They share one shape,
and understanding that shape is understanding most of the codebase.

### The common shape

A capability is a package with:

1. a **doc-comment** stating its single responsibility (and usually an explicit
   decoupling promise, e.g. "never imports document");
2. **value types** — its small domain model as plain structs;
3. a **`Scope`** struct (usually `ProjectID`) passed as the first parameter,
   carrying the *authorized* context from the gate;
4. one or more **port interfaces** it depends on — almost always a `Store` for
   persistence, plus behaviour ports for other capabilities' effects;
5. a **service struct** (named as the plural noun: `Files`, `Documents`,
   `Comments`) holding those ports, built by a **`New(...)`** constructor;
6. **methods** = the operations, pure functions over injected ports + scope +
   params;
7. a **`memory.go`** in-memory `Store` adapter for tests/dev;
8. HTTP **handlers outside** the capability, in `core/handlers/<cap>`, with
   construction in `core/wiring`.

`core/capability/file` is the clean template of this shape.

### Mostly stateless — three exceptions

The "mostly stateless" claim holds: the overwhelming majority of services are
pure functions over an injected `Store` + scope + params. The mutex-guarded maps
you might spot are in-file `MemoryStore` *adapters*, not service state. Genuinely
stateful services:

| Capability | State | Why |
|---|---|---|
| **notification** | In-memory per-(project,user) toast queues; *is* its own store | Ephemeral by design; a restart drops undrained toasts. |
| **presence** | In-memory TTL-pruned map keyed by document | Ephemeral caret/focus; no durability wanted. |
| **session** | Durable `Store` **plus** a buffered channel, a consumer goroutine, and a sweeper ticker | Presence events feed the activity feed asynchronously. |

`agent` additionally runs two background goroutines (a task reaper and a workflow
watcher) but keeps its durable state in an injected store.

### Ports & adapters — how A uses B without importing it

B declares a port interface; A exposes a service; **wiring writes a thin adapter**
wrapping A to satisfy B's port. Neither imports the other. Example
(`core/wiring/resource_document.go`): `resource` declares a `Family` port;
`document` exposes `*document.Documents`; wiring's `documentResourceFamily`
translates document values into `resource.Summary` and maps the error types — so
the unified resource catalog owns documents without importing the document
package. The same file's `documentAuthorizer` lets `agent` honour resource access
scopes without importing `resource`.

### The decoupling invariant, stated correctly

The rule has two halves, and both are load-bearing. It is enforced by
`core/architecture`; the exact temporary exceptions and their removal packets
live in `docs/completion/architecture-exceptions.tsv`:

> **Leaf capabilities never import each other. `agent` is the sanctioned
> composition tier and may depend on the capabilities it composes — but even
> there, every *behavioural* dependency goes through a port `agent` declares;
> a direct import carries shared value types only.**

18 of 21 capability packages import no other capability at all. The three that
do:

- `knowledge → intelligence` — **type-only** (shared `Tool*` value types to
  publish a search-tool binding). No service is called.
- `formula/names → formula` — **sanctioned library layering**. The stateful
  project name manager delegates expression evaluation to the pure formula
  service.
- `agent → document, intelligence, knowledge, notification, persona` — `agent`
  composes these. Every behaviour it needs is reached through a port it owns:
  `Reasoner`, `Retriever`, `PersonaResolver`, `Notifier`, `DocumentAuthorizer`,
  and `DocumentEditor`. The imports supply value types.

The second half is what makes this an architecture rather than an excuse. An
agent's document tools *author document content* — they emit real
`document.ChangeOp` values against the block tree — so speaking the document
model is intrinsic to the job; of the 25 `document.*` symbols `agent` uses, 24
are model types. Hiding those behind agent-owned duplicates would re-model the
document tree and guarantee drift. What must not leak is *behaviour*: reaching
into another capability's service. So `Workflows` holds a
[`DocumentEditor`](../../core/capability/agent/workflow.go) — `Get` plus
`SubmitChanges`, the two operations it actually uses — and the canonical
`*document.Documents` satisfies that port directly, so wiring injects the service
with no adapter (exactly as `notification.Notifications` satisfies `Notifier`).

Resolved as `COH-1` in [record 0114](../records/0114-agent-composition-tier.md).

### Per-capability map

| Capability | Responsibility | Model | State |
|---|---|---|---|
| access | Who is calling: users, sessions, projects, membership, roles, share links | Stores bundle | — |
| activity | Bounded project-scoped semantic event feed (read-only) | `Event` snapshots | — |
| agent | Composition-tier workflows: Ask, durable Tasks/Workflows, tool bindings | `Task` aggregate + config | bg loops |
| chat | Durable AI conversations (container + ordered turns + attachments) | via `ChatEngine` port | — |
| comment | Anchor-bound document discussion (comment + reply thread) | via `AnchorReader` port | — |
| connector | External-source connectors (local-folder/http) synced into the lattice | connector record + config | — |
| contexts | Named, nestable resource sets `{includes,excludes}` resolved live | ref store (resolution computed) | — |
| document | **The core aggregate**: block tree, changesets, history, markdown, templates, layout, prompt blocks | rich internal model | — |
| file | Project-scoped binary file store | metadata + opaque bytes | — |
| formula | Pure deterministic expression language (parser, values, evaluator) | pure library | — |
| intelligence | Single model-provider boundary, driven by semantic casts | cast→model config | — |
| knowledge | Per-project retrieval lattice (KLR clustering) with cited spans | lattice model | — |
| notification | Ephemeral per-user toast queues | in-memory | **yes** |
| organization | Orgs spanning projects + role memberships (narrows visibility only) | store | — |
| persona | Project-local versioned behaviour profiles | persona/version/default | — |
| presence | In-memory TTL presence keyed by document | in-memory | **yes** |
| reference | Directed reference graph (links + backlinks) | edge store + `Resolver` port | — |
| resource | Unified project catalog routing to owning `Family`; access scopes/attributes | family ports + attribute store | — |
| session | Ephemeral per-user presence feeding the activity feed | store + channel/goroutine | **yes** |
| workspace | Opaque per-user × per-project cockpit JSON blob | store | — |

---

## 7. Phase 5 — Persistence

One WAL-mode SQLite database behind every persistence port
(`core/platform/storage/sqlite`). Pragmas: `journal_mode=WAL`,
`busy_timeout=5000`, `_txlock=immediate`; `SetMaxOpenConns(8)` — eight concurrent
readers, a serialized writer, and the immediate lock closes read-then-write
races. There is no migration framework: the schema is declarative and additive
(`CREATE TABLE IF NOT EXISTS` + post-hoc `ALTER`/data-repair).

### The document concurrency model

A document is `base` (a JSON blob) + `base_seq` (the fold watermark) + `revision`
(the head sequence), plus an append-only `change_sets` table keyed unique on
`(document_id, seq)`. A read loads `base` and folds every change set with
`seq > base_seq` over it. "Pending" = the unfolded tail.

The admission gate `Store.AppendChangeSet` is the correctness core and is
airtight:

1. `BEGIN IMMEDIATE` — take the write lock up front.
2. Idempotency probe on `(document_id, author_id, submission_id)` — a re-submit
   returns the stored receipt; a conflicting hash is rejected.
3. **Compare-and-swap:** `UPDATE documents SET revision=? WHERE id=? AND
   revision=?` with the new seq = expected + 1. Zero rows affected → revision
   conflict.
4. Insert the change set, a history row, the submission receipt, and an activity
   fact — all in the same transaction — then commit.

When two clients submit against the same base, one wins seq R+1 and the other's
CAS matches zero rows. An ordinary edit then gets an admission conflict (the
client resyncs); an idempotent edit carrying a submission id runs a real
**commutativity proof** (`rebaseStaleOperations`, a read/write footprint model
that fails closed to a conflict, not a heuristic merge) and retries up to 8 times.
Undo/redo require the target to still be head, so a first undo can never clobber a
later collaborator.

**Edits do not go through the job queue.** Concurrency is controlled purely by
the per-document revision CAS: per-document-serial, cross-document-parallel, which
is the correct grain. Only `rebase` (representation maintenance — folding pending
sets back into `base`) is deferred to the job pool.

The one place the CAS discipline is dropped is `RebaseDocument`, a blind
`UPDATE ... WHERE id=?` with no `base_seq` guard, which — with two job workers and
no rebase-job dedup — can race another rebase or `PruneChangeSets` and, worst
case, drop change sets the folded base still needs. This is the single most
serious correctness finding, `BUG-1`.

---

## 8. File organization — how the tree mirrors the spine

The directory layout maps cleanly onto the runtime phases. **The layering is
right at the directory grain**; where it breaks down is at the *file* grain (a
few files large enough to hide the seams — see the companion's God-file section).

| Runtime layer | Directory | |
|---|---|---|
| Boot / config | `core/wiring` (composition + lifecycle), `core/platform/config`, `core/platform/devcert`, `core/platform/telemetry` | ✔ |
| Control / auth | `core/transport` (edge + `gate.go`), `core/capability/access`, `core/handlers/auth` | ✔ |
| Jobs / dispatch | `core/platform/job` (queue + pool), `core/platform/dispatch` (keyed mutex), `core/transport` (dispatch modes) | ✔ |
| Capabilities | `core/capability/*` — 21 Go packages across 20 top-level domains | ✔ |
| Persistence | `core/platform/storage/sqlite` | ✔ (one dir; one oversized file) |
| External adapters | `core/integration` (`intelligence/openrouter`, `context/web`) | ✔ |
| HTTP edge contract | `core/endpoint` — the transport-agnostic `Request`/`Response`/`Handler` seam, imported by ~32 files | ✔ |

- **`core/handlers/<cap>`** holds the HTTP handlers for each capability — the thin
  translation between the `endpoint` contract and a capability service. One
  handler package per capability.
- **`core/wiring`** is both the composition root *and* the home of every
  cross-capability adapter. Adapter files are named for the boundary they bridge
  (`resource_document.go`, `context_connector.go`, `document_scope.go`).
- **`core/architecture`** checks the real package graph, rejects wrong-way
  imports, and requires every temporary exception to be complete, exact, current,
  and under the frozen count ceiling.

### How the code sits under the files — one request, end to end

`POST /documents/:documentID/changes` (a serial mutation):

1. `core/transport/transport.go` — Echo matches the route on the `scoped` group.
2. `core/transport/gate.go` — `requireProject` resolves the cookie via
   `access.Resolve`, re-checks membership, stamps `ctx.Project.ID`.
3. `documentAccessGuard` narrows per-document AccessScope on `:documentID`;
   `sessionActivity` will bump presence on a 2xx.
4. `dispatchScoped("documents.append_changes", …)` finds mode `serial` in
   `operationMode`, so `adaptSerialScoped` takes the `KeyedMutex` for that
   document id.
5. `core/handlers/document/document.go` decodes the request and calls
   `documents.AppendChanges(ctx.Project.ID, …)` — passing the *authorized*
   project id, never a client value.
6. `core/capability/document/service.go` re-checks `doc.ProjectID`, applies the
   change set, and calls `store.AppendChangeSet(...)`.
7. `core/platform/storage/sqlite/sqlite.go` runs the `BEGIN IMMEDIATE` + revision
   CAS + inserts, and commits.

The same walk in reverse is the composition: `wiring.Run` built the `sqlite.Store`,
the `document.Documents` service over it, the handler, the gate middleware, and
the dispatch tables — in that dependency order — before the listener started.

---

## 9. See also

- [`issues-and-gaps.md`](issues-and-gaps.md) — where the running system falls
  short of this model (bugs, privacy, efficiency, durability, God files, drift).
- [`ports-and-adapters.md`](ports-and-adapters.md) — the executable dependency,
  startup closure, logical-cell, transaction, and deployment contract.
- [`docs/records/`](../records/README.md) — the numbered change records: how the
  code got to each state.
- [`docs/reference/`](../reference/README.md) — the aspirational north-star;
  consult for intent, defer to this document for what exists.
- Layer deep-dives (currently drifted in their inventories — see `DOC-1`):
  [`configuration.md`](configuration.md), [`transport.md`](transport.md),
  [`persistence.md`](persistence.md), and the per-capability set under
  [`capabilities/`](capabilities/).
