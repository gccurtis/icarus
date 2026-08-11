---
title: "Execute Ω-017 — Close the Document Project vertical slice"
packet_id: "Ω-017"
status: "ready-for-execution"
wave: "Wave 1 — Close the Project runtime"
depends_on: "Ω-006, Ω-008, Ω-009, Ω-010, Ω-011, Ω-012, Ω-013, Ω-014, Ω-015, Ω-016"
source_mirror: "docs/current-docs/notion/work-packets/omega-017-close-the-document-project-vertical-slice.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-017 — Close the Document Project vertical slice

## Mission

Certify Document as the first fully complete Project resource from persistence through HTTP: lifecycle, typed revision changes, undo/redo, history effects, comments and anchors, references, Context/prompt resolution, project-local template behavior already in scope, collaboration, access, Activity, Workspace, automatic Knowledge publication, and backend-only demonstration. Every current Document route has a bounded, caller-aware contract and deterministic evidence. There are no mocks, hidden manual steps, unowned TODOs, or handlers whose success cannot be reproduced after a restart. This packet is a closure pass, not a new Document model. It integrates and proves the mature capability Omega already has plus the safety/runtime work in Ω-006–Ω-016.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-006, Ω-008, Ω-009, Ω-010, Ω-011, Ω-012, Ω-013, Ω-014, Ω-015, Ω-016**.

Source dependency statement: Ω-006 and Ω-008 through Ω-016

No later-packet integration gate was detected in the source dependency statement.

Start only after every hard predecessor is present on `main`. If a predecessor is intentionally being developed in parallel, do not guess across its contract: stop until it lands on `main` or request an agreed interface.

## Authority order

When sources disagree, use this order:

1. The latest explicit product decision from the user.
2. The current Primary documents under `docs/current-docs/notion/primary/`.
3. This execution directive and the packet-specific implementation specification below.
4. Current code, tests, migrations, and as-built architecture records on the actual starting `main`.
5. Supporting documents and frozen historical links.

`AGENTS.md` remains authoritative for repository workflow. The SHA in this file is the planning baseline, not an instruction to reset: always begin from the latest approved `main` that contains the required predecessors, and record the actual starting SHA.

## Required reading before editing

- `AGENTS.md` — repository rules; this is authoritative for workflow, validation, and documentation records.
- `docs/current-docs/README.md` — authority model and corpus layout.
- `docs/current-docs/notion/work-packets/omega-017-close-the-document-project-vertical-slice.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `docs/current-docs/notion/primary/model-workspace-capability-and-runtime-contract--3acb6410e502.md`
- `docs/current-docs/notion/primary/workstreams-taurus-product-completion--3acb6410e502.md`
- `core/capability/comment/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/contexts/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/document/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/knowledge/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/presence/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/reference/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/resource/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/workspace/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/handlers/document/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/platform/storage/sqlite/sqlite_document*.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `dev-test/documents/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `docs/backend-guide.md` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.

Follow links inside the embedded specification when they resolve to additional local mirrors. Search the current repository for every type, route, table, tool, and invariant named below; do not rely on an old path or assume absence without checking.

## Preflight

Before changing code:

1. Record the starting `main` HEAD SHA, merged predecessor packets, and relevant existing records.
2. Reproduce or characterize the current gap with a focused test, probe, route inventory, or schema inspection.
3. Compare the packet against current code. Preserve correct partial implementations and delete or migrate only what the specification makes obsolete.
4. Identify the capability owner, its inbound ports, outbound ports, adapters, durable state, authorization point, transaction boundary, and observability boundary.
5. Confirm every proposed third-party dependency is free/open-source, pinned, and compatible with product distribution. Prefer the standard library or existing dependencies.
6. Write the smallest ordered implementation plan that can land without leaving accepted-but-unusable intermediate states.

If the gap is already fully closed, do not manufacture changes. Prove it with the required tests/evidence, reconcile stale documentation, and produce the normal change record and a verified commit on `main`.

## Execution contract

- Stay inside this packet's scope and explicit prerequisites. Do not opportunistically implement later packets.
- Preserve the modular-monolith, ports-and-adapters boundary. User Cells and per-user Project Subcells are logical runtime scopes; durable database state, revisions, CAS/idempotency, jobs, and outbox/change streams are correctness authorities.
- Enforce authorization at the owning application service/store boundary, not only in HTTP handlers. Reads, listings, search, events, history, jobs, and model/tool hydration must be caller-aware.
- Make durable mutations atomic at the stated aggregate boundary. Couple canonical state and required outbox/audit/idempotency writes in one transaction where the specification requires it.
- Keep retries, pagination, resource limits, concurrency, shutdown, and failure behavior explicit and bounded. No correctness may depend on sticky routing or one in-memory cell.
- Add or update typed errors and stable wire mappings without leaking hidden resource existence or secrets.
- Prefer focused tests first, then implementation, then broader integration, race, recovery, and load evidence required by the specification.
- Do not add placeholder handlers, no-op adapters, unbounded defaults, silent fallbacks, or TODO-only completion.
- Do not create companion `.go.md` files; that convention is retired. Add the numbered change record required by `AGENTS.md`.

## Decision authority

You may decide internal naming, package decomposition, private helper design, migration mechanics, indexes, test fixtures, and the exact FOSS library when the packet leaves those open. Choose the smallest production-grade option consistent with existing conventions. Record every material choice and rejected alternative in the change record.

Stop and ask for direction before proceeding if any choice would:

- contradict a settled Product/Primary architecture decision or another merged packet;
- weaken tenant, user, organization, project, or resource privacy boundaries;
- introduce destructive or irreversible migration without a tested rollback/restore path;
- add a non-FOSS, source-available-only, or materially costly external dependency/service;
- change a public contract outside this packet or make a later packet impossible;
- require guessing an unmerged predecessor's interface; or
- make an acceptance criterion impossible or only cosmetically satisfied.

## Validation and evidence

Run the narrowest relevant tests while iterating. Before commit, run the repository gates from `AGENTS.md`:

```bash
./scripts/check-format.sh
go build ./...
go test ./...
```

Also run every packet-specific test, race test, integration test, migration test, recovery test, load test, or live-provider certification required below. Live-provider tests may be skipped only when the required credential is unavailable; report the skip, fixture coverage, token/cost estimate where applicable, and the exact command for a credentialed rerun. Never claim a skipped gate passed.

Review the final diff for secret leakage, hidden-resource inference, unsafe logs, accidental broad scope, stale generated files, and unclassified dependencies.

## Required deliverables

1. Production implementation and migrations/adapters required by the specification.
2. Focused and broad automated tests proving the acceptance criteria.
3. API/schema/error/operations documentation actually changed by the implementation.
4. One new numbered `docs/records/NNNN-<slug>.md` record describing baseline, decisions, files, tests, operational effects, and remaining risks.
5. A commit scoped to this packet, pushed directly to `origin/main`.

The change record and completion handoff must state:

- actual baseline SHA and prerequisite packet status;
- outcome and user-visible/operational behavior;
- architecture and data-model decisions;
- migrations, compatibility, rollback, and rollout notes;
- security/privacy analysis;
- tests and exact commands/results, including skips;
- observability and operator impact;
- unresolved risks or follow-up packets; and
- a checklist mapping every acceptance criterion below to code/tests/evidence.

## Completion response

Return a concise handoff containing: commit SHA, changed areas, test results, migration/rollout notes, record path, and any explicit residual risk. Do not report this packet complete while an acceptance criterion is unproven or a required gate is failing.

---

## Embedded implementation specification

Source mirror: `docs/current-docs/notion/work-packets/omega-017-close-the-document-project-vertical-slice.md`

## Outcome
Certify Document as the first fully complete Project resource from persistence
through HTTP: lifecycle, typed revision changes, undo/redo, history effects,
comments and anchors, references, Context/prompt resolution, project-local
template behavior already in scope, collaboration, access, Activity, Workspace,
automatic Knowledge publication, and backend-only demonstration. Every current
Document route has a bounded, caller-aware contract and deterministic evidence.
There are no mocks, hidden manual steps, unowned TODOs, or handlers whose
success cannot be reproduced after a restart.
This packet is a closure pass, not a new Document model. It integrates and proves
the mature capability Omega already has plus the safety/runtime work in
Ω-006–Ω-016.
## As-built evidence
Document is Omega's most complete resource. It already has a structured
base/change-set/revision model, optimistic submit, undo/redo, comments,
references, presence, Context and prompt-block behavior, template-related
surfaces, import/export paths, history, and extensive handlers/tests. It is also
the only editor model Alpha currently exercises end to end.
Its remaining risk is integration fragmentation. Access filtering, mark
admission, Activity source provenance, automatic Knowledge publication,
Workspace unified undo, Project events, Resource lifecycle conformance, and
failure/redaction contracts have been owned by preceding packets. Existing
row-window endpoints are shipped behavior but Alpha's latest runtime no longer
requires them. They should remain tested and documented until a separate removal
decision; do not rebuild or expand them merely to satisfy an old request.
## Scope
- Build a complete Document operation/route/state/authorization matrix.
- Resolve every partial, dead, nil-gated, dev-only, or untested current
	Document path.
- Verify create/get/snapshot/change/undo/redo/history/lifecycle and idempotency.
- Complete comments, stable anchors/rebasing, threads, resolve/reopen, and
	caller-aware visibility.
- Complete references/backlinks and Context/prompt-block resolution.
- Complete current project-local Document template and Markdown/plain-text
	import/export behavior.
- Integrate Resource, Workspace, Activity, Presence, Project events, and
	automatic Text-lattice publication.
- Define limits, errors, cursors, revision conflicts, cancellation, and
	observability consistently.
- Add a canonical backend-only Document demonstration and a closure report
	mapping every matrix row to evidence.
## Non-goals
- No redesign of Document base, row/block/atom address model, or change-set
	semantics.
- No Spreadsheet, Slides, or Chat editor work.
- No DOCX or PDF conversion; Wave 4 owns those adapters.
- No user-level Template library or cross-resource template parameter contract;
	Ω-020 and Wave 5 own them.
- No new visual editor/layout behavior in Alpha.
- No new Formula capability semantics.
- No removal or redesign of stable row-window routes in this packet.
- No ingestion of inferred/generated blocks as authoritative evidence.
## Completion invariants
1. Every mutation is admitted by the Document domain, authorized with explicit
	Project/caller scope, revision-CAS protected, idempotent, and atomic with its
	required outbox records.
2. Reads never depend on handler-only filtering and use Ω-010 wire semantics.
3. A comment/reference/prompt anchor is either resolved to the exact caller-
	visible structure, reported missing/stale explicitly, or redacted; it never
	silently points at different content.
4. Undo/redo exposes semantic effects while private inverse operations stay
	private. Workspace coordination cannot undo invisible content.
5. A successful committed revision is durable after restart and enters the
	automatic publication pipeline exactly once.
6. Import, duplicate, template materialization, and restore pass the same
	whole-base invariants and mark/style validation as ordinary edits.
7. Every list is bounded and cursor-safe; every payload has explicit byte/item/
	nesting limits.
8. “Complete” means deterministic service, store, transport, integration, race,
	recovery, negative-security, and backend-E2E evidence.
## Representative service contract
```go
type DocumentService interface {
    Create(context.Context, ProjectScope, CreateDocument) (DocumentSnapshot, error)
    Get(context.Context, ProjectScope, string, ReadOptions) (DocumentSnapshot, error)
    Submit(context.Context, ProjectScope, string, SubmitChangeSet) (SubmitResult, error)
    Undo(context.Context, ProjectScope, string, HistoryCommand) (SubmitResult, error)
    Redo(context.Context, ProjectScope, string, HistoryCommand) (SubmitResult, error)
    History(context.Context, ProjectScope, string, Page) (HistoryPage, error)
    Effects(context.Context, ProjectScope, string, string) (ChangeEffects, error)
}

type SubmitChangeSet struct {
    BaseRevision   int64
    IdempotencyKey string
    Operations     []Operation
}

type SubmitResult struct {
    Revision   int64
    ChangeSet  string
    Effects    []PublicEffect
    Published  PublicationHint
}
```
Lifecycle remains available through Ω-015's Resource contract. Comment,
reference, prompt/template, and collaboration services use `ProjectScope` and
stable Document addresses rather than accepting arbitrary embedded content
copies.
## HTTP closure matrix
The exact existing routes come from Ω-001; target groups after Ω-011 are:
```plain text
/projects/:projectID/documents
/projects/:projectID/documents/:documentID
/projects/:projectID/documents/:documentID/changes
/projects/:projectID/documents/:documentID/history
/projects/:projectID/documents/:documentID/undo
/projects/:projectID/documents/:documentID/redo
/projects/:projectID/documents/:documentID/comments
/projects/:projectID/documents/:documentID/references
/projects/:projectID/documents/:documentID/presence
/projects/:projectID/documents/:documentID/prompts
/projects/:projectID/documents/:documentID/publication
```
Keep existing route names where established. For each operation record:
method/path, permission, serial key, request/response schema, limits, expected
revision/idempotency, success, typed 4xx/409/422/429/5xx behavior, Activity
source, Project event, Knowledge effect, and test.
## Likely paths
- `core/capability/document/`
- `core/handlers/document/`
- `core/capability/comment/`
- `core/capability/reference/`
- `core/capability/contexts/`
- `core/capability/presence/`
- `core/capability/resource/`
- `core/capability/workspace/`
- `core/capability/knowledge/`
- `core/platform/storage/sqlite/sqlite_document*.go`
- `dev-test/documents/`
- `docs/backend-guide.md`
## Ordered implementation
1. Generate the Document closure matrix from routes, dispatch, wiring, store
	ports, migrations, tests, Alpha requests, and active Yesod pages. Classify
	each row complete, integration gap, defect, intentionally preserved, or
	Wave-4 deferred.
2. Add a black-box conformance harness covering Resource lifecycle plus
	Document snapshot/change/history semantics before closing individual gaps.
3. Complete create/get/list/snapshot/title and lifecycle integration. Assert
	family/resource identity, caller scope, trash/restore, duplicate lineage,
	pagination, and restart behavior.
4. Complete change admission: all operation kinds, whole-base/style invariants,
	bounded payloads, stable ids, expected revision, idempotent replay, conflict
	body, Activity source, Project event, publication outbox, and failure
	atomicity.
5. Complete undo/redo/history/effects. Cover concurrent history, pruning,
	unavailable before-values, unified Workspace coordination, and event/
	publication behavior.
6. Complete comments and anchors: create/edit/delete/resolve/reopen, thread
	paging, change rebasing, deleted/stale address, hidden author/resource,
	mention/notification bounds, and purge cleanup.
7. Complete references/backlinks and Context/prompt resolution. Validate both
	ends, prevent cycles/unbounded expansion, preserve source provenance, and
	guarantee caller-visible material only.
8. Complete current project-local template and Markdown/plain-text interchange
	paths. Route generated bases through the same validators and disclose
	best-effort losses. Do not pre-empt Ω-020 or Wave 4.
9. Complete Presence and live events with Ω-014, including join/move/leave,
	snapshot, revision notification, hidden selections, disconnect, and polling
	fallback.
10. Preserve current row-window endpoints with honest contract tests and mark
	them compatibility/stable rather than a new preferred frontend path.
11. Remove or implement all Document TODO/panic/mock/nil-gated production paths.
	A disabled external provider must return a typed unavailable error and leave
	state unchanged.
12. Build the canonical backend-only demo, run every gate/live suite, publish
	closure evidence, update companions/baseline/backend guide, and add the
	numbered record.
## Security, concurrency, persistence, and observability
Serial execution is keyed by Project+Document while persistence CAS remains the
cross-process correctness boundary. Reads take coherent revision snapshots.
Comments/references/presence do not grant access to the Document or an opposite
edge. Prompt resolution and Ask integration send only currently authorized
sources to a model.
Every committed revision atomically records required Activity/event/publication
outboxes. Recoverers reconcile from authoritative change sets without replaying
external side effects twice. Purge verifies dependent comments, references,
Workspace targets, jobs, and Knowledge cleanup.
Metrics include operation/outcome, conflict rate, base/change bytes, revision
latency, history depth, anchor status, publication lag, and subscriber counts
using bounded labels. Logs contain ids/codes/revisions, not Document text,
comments, prompts, resolved Context, or marks.
## Tests and gates
- Domain property/fuzz tests for all operations and structural invariants.
- SQLite store contract, migration rerun, restart, rollback/crash matrix, and
	reconciliation tests.
- HTTP golden contracts for every closure-matrix row and typed failure.
- Owner/editor/viewer/denied/nonmember tests over Document, comments,
	references, presence, Context resolution, history, and publication.
- Concurrent submit/undo/redo/comment/rename/trash cases under race detector.
- Anchor rebasing across insert/delete/move and history pruning.
- Maximum-size/nesting/page/rate/cancellation tests.
- Alpha contract smoke suite and preserved row-window suite.
- Canonical backend demo:
	create → edit/format/comment/reference → resolve prompt Context → collaborate
	→ publish → Ask/cite → undo/redo → close tab/unified undo → restart/resume →
	trash/restore/duplicate.
- Live provider suites print usage/cost and skip explicitly without credentials.
- Standard build/test/format/companion gates.
## Completion evidence
- Every matrix row links to passing deterministic evidence.
- The canonical demo runs without Alpha or manual database/file intervention.
- New/edited Document text becomes Ask evidence automatically.
- No current Document production path is mock, nil-gated without a typed error,
	or dependent on a dev route.
- The closure report names only Office/PDF and future cross-resource/user-library
	work as deferred.
## Dependencies
Depends on Ω-006 and Ω-008 through Ω-016. Blocks Ω-019's complete Agent demo,
Ω-020 template generalization, and Document conversion work in Wave 4.
## Sources
- [Omega Document capability](https://github.com/gccurtis/taurus-omega/tree/b8ba4aa05974ff21746f14b71acaf09117d38dcf/core/capability/document)
- [Alpha backend-request index](https://github.com/gccurtis/taurus-alpha/blob/aee846567e77d5bc13b264479fd19d2994babbc0/docs/backend-requests/README.md)
- [Model — Workspace Capability](https://app.notion.com/p/3acb6410e50281ddaa6dca8f6e1802fb)
- [Workstreams — Taurus Product Completion](https://app.notion.com/p/3acb6410e50281bf8987c9a87e6687dd)
---

