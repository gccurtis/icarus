# Taurus Nova implementation evidence

## Scope

This page records reusable product evidence from Taurus Nova for Omega
capability authors. It is pinned to `gccurtis/merkabah` commit
[`3df790b2ac736f644e577ae4e6f4e899e6e85b6d`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d).
It does not establish Omega architecture, production certification, or a
migration obligation. Apply the source order in [`source-register.md`](source-register.md).

## Executive evidence map

| Capability | Evidence class | What Nova actually proves | What remains target-only for Omega |
| --- | --- | --- | --- |
| Documents | Working legacy | File-backed CRUD, stable block IDs, optimistic versions, paragraph/heading/prompt blocks, marks/provenance transport, ProseMirror round-trip | Product-authorized durable Document state, base + ChangeSets + head, richer blocks, comments, autosave, undo/revert, complete headless rendering |
| Prompt blocks | Working legacy | Draft/resolve/refresh/dirty/failed states, editable prompt and display, bounded history, grounded source references, dirty propagation | Product command path, durable Resolution jobs, rich display, exact evidence sealing, decisions, pause/resume |
| Knowledge | Working legacy | Document ingestion, eligibility policy, embeddings/windows, lattice retrieval, exact-scan audit, artifacts, source removal and staleness | Project-durable multi-family corpus, governed sufficiency, incremental production maintenance, operational rebuild/recovery |
| Intelligence | Working legacy | Deterministic fake, provider-backed inference/embeddings, cast support and health | Provider registry, separate Embedding/Inference/Reasoning contracts, streaming/tools, budgets, receipts, durable usage and production policy |
| Formula | Implemented primitive | Lexer, parser, AST, typed values, evaluator, built-ins, parse/evaluate/explain | Resource consumers, named formulas/tables, dependency evaluation, recalculation, persistence, UI |
| Identity and sessions | Working durable | OIDC+PKCE, exact issuer/subject linking, encrypted verifier storage, opaque sessions, CSRF, expiry, rotation, replay-family and User revocation | Live operator-provider proof, production key recovery, Omega one-Organization relationship and D007 permit semantics |
| Access, organizations, projects | Working durable, conflicting model | Deny-by-default roles, membership epochs, project provisioning/fencing and crash reconciliation | Omega's one Organization per User, sole Project owner, direct User grants, one Project Database per Project |
| Entitlements | Working durable | Expiring/scoped grants, fail-closed checker, baseline seeding | Billing/quota administration and production policy operations |
| Resource registry | Working durable metadata | Project Resource identity, kind registry, metadata lifecycle, family ports | Canonical family content except legacy Documents; full family operations and exports |
| Workspace | Working durable | Per-User/Project permanent destinations, Resource tabs, active view and panels with optimistic versions | Complete Data/Agents destinations, route-backed shareability, offline/multi-device convergence |
| Product API | Working local/test | OIDC, session, organization, Project, Resource metadata, and Workspace routes with hardened middleware | Product Document/Knowledge/Formula/Agent/import/export APIs and production promotion |
| Jobs, Audit, Activity, realtime | Implemented primitives | Leased durable jobs, typed Audit/Change/Activity concepts, versioned realtime/resync contracts | Complete capability-owned journeys, promoted workers/transports, multi-user Resource collaboration proof |
| Workbooks, Decks, Boards, Chats, Files, Agents | Presentation-only or target-only | Navigation names and planning authorities | Canonical models, handlers, durable state, public operations, headless proof |

## Documents

Nova's [`internal/document/model.go`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/document/model.go)
defines `Document`, `Block`, `Mark`, `Anchor`, and `Provenance`. Active block
kinds are paragraph, heading, and prompt. The forward contract in
[`model_atoms.go`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/document/model_atoms.go)
adds `Atom` and `DisplayContent`, but comments explicitly say these are not the
current storage primitive.

[`Service.Create`, `Get`, `List`, `ReplaceBlocks`, `Rename`,
`UpdateBlockData`, and `Delete`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/document/service.go)
are real behavior. `UpdateBlockData` is a fine-grained optimistic operation;
`ReplaceBlocks` replaces the entire ordered block list. Persistence remains
file-backed through
[`file_store.go`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/document/file_store.go),
and mutations append to a development change log rather than Omega's canonical
Document ChangeSet history.

The browser proof uses
[`DocumentEditor.svelte`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/web/src/documents/DocumentEditor.svelte)
and
[`ProseMirrorDocumentSurface.svelte`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/web/src/documents/ProseMirrorDocumentSurface.svelte).
It proves marks, slash insertion, selection mapping, block handles, stable-ID
serialization, and explicit save/reload behavior. The routes are under
`/dev/documents`; there is no Product Document-content route. Product Resource
creation stores a `legacy_document` family reference, which is explicitly a
compatibility seam and must not be copied.

Proof anchors:

- [`internal/document/service_test.go`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/document/service_test.go)
  covers versions, stable IDs, conflicts, restart persistence, kinds, and
  extraction policy.
- [`web/scripts/serialize-check.ts`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/web/scripts/serialize-check.ts)
  characterizes editor round-trip safety.
- [Operation Vellum](https://app.notion.com/p/394b6410e502819c9cf1e59c10fba631)
  and [Operation Manuscript](https://app.notion.com/p/395b6410e5028176a30de7f8d7fc25b8)
  record the intended full family beyond the proof.

## Prompt blocks

[`promptblock.Data`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/document/promptblock/model.go)
keeps prompt source, Knowledge artifact identity, state, visible and generated
display, errors, sources, edit state, revision, and a bounded history. Implemented
states are draft, resolving, resolved, dirty, and failed.

The behavior is split across:

- [`service.go` `Insert` and `Inspect`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/document/promptblock/service.go)
- [`resolve.go` `Resolve`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/document/promptblock/resolve.go)
- [`refresh.go`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/document/promptblock/refresh.go)
  for grounded ordinary and force refresh
- [`display.go`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/document/promptblock/display.go)
  for user-visible edits
- [`dirty.go`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/document/promptblock/dirty.go)
  for source-driven staleness.

Important retained semantics: stale visible output is not erased on source
change or inference failure; the generated value is distinct from a User edit;
ordinary refresh preserves an unchanged User edit; force refresh adopts the new
generated output; the latest five display histories are retained. These are
behavioral evidence for Omega's Document-owned prompt block. Nova's direct
ungrounded resolve path is not the Omega target; the governed flow is specified
in [`../flows/prompt-resolution.md`](flows/prompt-resolution.md).

## Knowledge and retrieval

[`internal/knowledge/model.go`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/knowledge/model.go)
contains `Source`, `BaseArtifact`, `Window`, `LatticeNode`, `LatticeIndex`,
`Artifact`, `GroundedRegion`, `RetrievalAudit`, and `KnowledgePolicy`.

Working behavior includes:

- [`IngestDocument`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/knowledge/ingest.go)
  with eligibility and content-hash idempotency;
- [`Retrieve` and `RetrieveAudit`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/knowledge/retrieve.go)
  with lattice descent and exact-scan comparison;
- [`RebuildLattice`, `UpdateDocumentSource`, and `Lattice`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/knowledge/lattice_maintain.go);
- source removal and dependent-artifact dirtying in
  [`source_ledger.go`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/knowledge/source_ledger.go); and
- the explicit, non-event coordinator
  [`knowledge/live.Service.IngestAndMarkDirty`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/knowledge/live/service.go).

Generated prompt output is excluded from ingestion by default unless explicitly
made canonical. Retrieval can refuse inference when no grounding exists. The
important Omega extension is to make Sources and artifacts Project-durable,
multi-family, exact-versioned, governed by a sufficiency decision, and
operationally rebuildable. [Operation Lattice](https://app.notion.com/p/394b6410e50281c88ab9e42ba2d140ce)
is target evidence, not proof that Nova delivers those extensions.

## Intelligence

Nova's provider boundary uses `Cast`, `InferRequest`, `InferResponse`, and
`HealthInfo` in
[`internal/intelligence/model.go`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/intelligence/model.go).
[`gateway.go`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/intelligence/gateway.go)
provides `ModelClient`, `FakeClient`, `Servable`, and `Infer`;
[`embeddings.go`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/intelligence/embeddings.go)
records embedding identity; and
[`openrouter.go`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/intelligence/openrouter.go)
is a real provider adapter.

Omega should retain provider-neutral casts, deterministic fakes, serviceability
checks, embedding identity, bounded requests, and sanitized failures. The
separate Embedding, Inference, and Reasoning endpoint contracts; routing epochs;
provider receipts; tools/streaming; usage/cost; budgets; and policy remain
target-only.

## Formula

[`internal/formula`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/formula)
is a useful pure-capability proof. It has a lexer, parser, AST, evaluator,
structured errors, JSON-stable values, environments, arithmetic, `IF`, `LET`,
and aggregate/text built-ins. `Service.Parse`, `Evaluate`, and `Explain` are
headlessly testable.

Current main does not prove named formulas, named tables, dependency graphs,
incremental recalculation, persisted slots, Resource consumers, or UI. Those
belong to the complete Formula capability grounded by
[Operation Calculus](https://app.notion.com/p/394b6410e50281259c75dfbe9121c002).

## Identity, sessions, authority, Projects, and Workspace

Nova has strong durable implementation evidence here:

- [`internal/identity`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/identity)
  implements Authorization Code + PKCE, one-use attempts, browser/nonce checks,
  exact case-sensitive identity keys, safe returns, and durable encrypted
  verifier storage.
- [`internal/session/runtime`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/session/runtime)
  implements opaque selector/secret sessions, CSRF, idle/absolute expiry,
  rotation lineage, predecessor replay-family revocation, and User-wide
  revocation primitives.
- [`internal/access`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/access)
  has a closed action registry and deny-by-default decisions.
- [`internal/project/runtime`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/project/runtime)
  proves provisioning, fence placement, activation, and crash reconciliation.
- [`internal/entitlement/mysql`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/entitlement/mysql)
  proves fail-closed durable grant checks.
- [`internal/app/productworkspace/durable.go`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/app/productworkspace/durable.go)
  composes six identity-through-Workspace stores behind the durable flag, and
  [`test/integration/durable_composition_integration_test.go`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/test/integration/durable_composition_integration_test.go)
  proves restart, revocation, isolation, and fail-closed cases against MySQL.

The relationship model must not be copied. Nova permits a User in multiple
Organizations and multiple Project owners; Omega D004 requires one Organization
per User, one User owner, and direct User grants. Nova's active-organization
session field likewise has no Omega authority role.

Nova's Resource and Workspace metadata are durable. `resource.Record` and its
kind registry provide lifecycle and sealed-family-port evidence;
`workspace.Snapshot` distinguishes durable permanent destinations/tabs/panels
from transient selection and New Tab state. Only legacy Document content is
composed. Data and Agents are placeholders.

## Product API and frontend

The local/test Product edge implements:

```text
GET  /api/v1/auth/providers
GET  /api/v1/auth/{provider_id}/begin
GET  /api/v1/auth/{provider_id}/callback
POST /api/v1/auth/demo
GET  /api/v1/session
POST /api/v1/session/sign-out
GET  /api/v1/organizations
GET  /api/v1/projects?organization_id=...
POST /api/v1/projects
GET  /api/v1/projects/{project_id}/resources
POST /api/v1/projects/{project_id}/resources
GET  /api/v1/projects/{project_id}/workspace
PUT  /api/v1/projects/{project_id}/workspace
```

The OpenAPI contract reserves additional Resource routes, but unregistered
routes are not working behavior. The Svelte application proves sign-in,
Project selection/create, Overview, transient New Tab, Resource tabs, context
and inspector panels, and session/Project generation fences that discard late
responses. Its Document editor remains mounted through a loopback `/dev`
bridge.

Omega keeps the UX lessons—generation fencing, transient selection, durable
destinations, typed contracts, strict origin/host/CSRF controls—but exposes
complete Product capability operations rather than a compatibility bridge.

## Jobs, Audit, Activity, and realtime

Nova contains implementation primitives that should inform, not predetermine,
Omega:

- MySQL durable jobs cover enqueue, claim, lease, heartbeat, retries, schedule,
  cancellation, settlement, and requeue.
- typed ChangeSet and immutable Audit records distinguish canonical security
  attribution from user-facing Activity and telemetry;
- realtime frames, generation fencing, authorized subscription, slow-consumer
  handling, and snapshot-plus-cursor resync are specified and tested.

No promoted Nova capability owns a complete production journey through these
pieces. Omega requires effects and required Audit to commit atomically, durable
jobs to be owned by the effect transaction, and realtime to remain an optional
hint. See [`../architecture/jobs-audit-observability.md`](architecture/jobs-audit-observability.md).

## Evidence that must not be overstated

- Green tests do not certify production boot, failover, backup/restore,
  provider outage, key rotation, performance, or accessibility.
- A SQL table without a composed live path is representation evidence only.
- A Notion operation is target behavior, not executable proof.
- A generated OpenAPI operation without a registered handler is not a route.
- A screen label is not a capability.
- A Nova role, Organization relationship, database topology, or compatibility
  adapter does not override an Omega decision.
