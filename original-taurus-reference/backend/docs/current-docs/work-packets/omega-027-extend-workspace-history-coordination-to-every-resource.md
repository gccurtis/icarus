---
title: "Execute Ω-027 — Extend Workspace history coordination to every resource"
packet_id: "Ω-027"
status: "ready-for-execution"
wave: "Wave 2 — Implement every resource capability"
depends_on: "Ω-012, Ω-014, Ω-017, Ω-021, Ω-022, Ω-023, Ω-024, Ω-025, Ω-026"
source_mirror: "docs/current-docs/notion/work-packets/omega-027-extend-workspace-history-coordination-to-every-resource.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-027 — Extend Workspace history coordination to every resource

## Mission

Workspace provides one user-visible undo/redo experience across Document, Spreadsheet, Slides, and Chat without mutating content the user cannot see. Each history entry points to the exact Resource and content ChangeSet it affects. If undo targets a closed tab, Workspace reopens and focuses the Resource before the content inverse is committed. Context-panel and Inspector-panel lens state for every editor persists with the tab and survives sign-out/restart. The coordinator stays under Workspace behind a content-history port. History does not import Workspace, preserving Omega's capability-isolation rule.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-012, Ω-014, Ω-017, Ω-021, Ω-022, Ω-023, Ω-024, Ω-025, Ω-026**.

Source dependency statement: Ω-012, Ω-014, Ω-017, Ω-021–Ω-026.

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
- `docs/current-docs/notion/work-packets/omega-027-extend-workspace-history-coordination-to-every-resource.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `core/capability/document` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/history` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/workspace` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/wiring/wiring.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.

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

Source mirror: `docs/current-docs/notion/work-packets/omega-027-extend-workspace-history-coordination-to-every-resource.md`

**Type:** Supporting  
**Wave:** 2 — Implement every resource capability  
**Gate:** Project Backend Complete  
**Depends on:** Ω-012, Ω-014, Ω-017, Ω-021–Ω-026  
**Unblocks:** coherent multi-editor undo and the backend completion demonstration
## Outcome
Workspace provides one user-visible undo/redo experience across Document,
Spreadsheet, Slides, and Chat without mutating content the user cannot see.
Each history entry points to the exact Resource and content ChangeSet it affects.
If undo targets a closed tab, Workspace reopens and focuses the Resource before
the content inverse is committed. Context-panel and Inspector-panel lens state
for every editor persists with the tab and survives sign-out/restart.
The coordinator stays under Workspace behind a content-history port. History
does not import Workspace, preserving Omega's capability-isolation rule.
## Current evidence
- At the reviewed baseline, Workspace is an opaque last-write-wins JSON blob
	keyed by user × selected Project with only `GET /workspace` and
	`PUT /workspace`.
- The newer Workspace aggregate/implementation pages choose
	`workspace_aggregates`, typed revisions, migrate-on-first-read, and a
	Workspace-owned coordinator behind `ContentHistoryPort`; Ω-012 lands that
	foundation.
- Document already has ChangeSet/history/undo/redo. Ω-021–Ω-026 add equivalent
	contracts to Spreadsheet, Slides, and Chat.
- A previous suggestion to have `core/capability/history` import Workspace
	conflicts with the repo's isolation law and is rejected.
## Before and after
```plain text
Before Ω-027
Workspace aggregate from Ω-012
  + Document history adapter only
  + resource-specific history islands

After Ω-027
core/capability/workspace/
  history.go
  content_history_port.go
  coordinator.go
core/wiring/
  workspace_history_registry.go

WorkspaceHistoryCoordinator
  ├── DocumentHistoryPort
  ├── SpreadsheetHistoryPort
  ├── SlidesHistoryPort
  └── ChatHistoryPort
```
## Scope
- Register all four Resource history adapters.
- Persist unified per-user Workspace history cursors/entries.
- Reveal/reopen/focus a Resource before undo/redo.
- Restore the relevant selection and panel/lens state when safe.
- Define atomic/saga behavior and recovery for Workspace/content coordination.
- Add unified commands, projections, authorization, events, and backend E2E.
## Non-goals
- No global rollback of other users' work.
- No undo of background model/provider side effects such as billed tokens,
	external connector writes, or sent messages.
- No invisible batch undo across multiple unrelated Resources.
- No capability imports between Resource implementations.
- No frontend keyboard handling.
## Governing invariants
1. An undoable entry identifies one Project, actor, Resource kind/ID, content
	ChangeSet ID, before/after content revisions, and reveal destination.
2. Undo/redo re-authorizes current Project membership and Resource access.
3. Content mutation is not attempted until the client-visible Workspace
	transition can reveal the target.
4. A successful response leaves the target tab open, focused, and selected.
5. Failure before content commit leaves content unchanged.
6. Failure after content commit is recoverable from a durable coordinator step
	and cannot report success while the Workspace still hides the target.
7. Workspace history never treats another actor's ChangeSet as the caller's
	ordinary undo unless an explicit administrative contract allows it.
8. Closed/deleted/inaccessible Resources return typed blocked outcomes rather
	than mutating invisibly.
9. Every command is idempotent and revision checked on both Workspace and
	content sides.
10. Redo is invalidated according to one documented rule when new content work
	occurs after undo.
## Core contracts
```go
type ResourceHistoryRef struct {
    Kind           resource.Kind
    ResourceID     string
    ChangeSetID    string
    ActorID        string
    BeforeRevision int64
    AfterRevision  int64
}

type RevealDestination struct {
    TabID          string
    ResourceKind   resource.Kind
    ResourceID     string
    Selection      json.RawMessage
    ContextLens    string
    InspectorLens  string
}

type WorkspaceHistoryEntry struct {
    ID          string
    WorkspaceID string
    ActionID    string
    Content     ResourceHistoryRef
    Reveal      RevealDestination
    State       string // ready | undoing | undone | redoing | blocked
    CreatedAt   time.Time
}

type ContentHistoryPort interface {
    Kind() resource.Kind
    Inspect(ctx context.Context, ref ResourceHistoryRef) (HistoryState, error)
    Undo(ctx context.Context, command HistoryCommand) (HistoryResult, error)
    Redo(ctx context.Context, command HistoryCommand) (HistoryResult, error)
}
```
The registry is constructed in wiring:
```go
registry := workspace.NewHistoryRegistry(
    documentHistory,
    spreadsheetHistory,
    slidesHistory,
    chatHistory,
)
```
## Coordination state machine
Prefer one SQLite transaction when Workspace and content stores share the same
database and can participate through a narrow transaction runner. The logical
steps remain explicit so a future multi-store adapter can use a saga:
```plain text
ready
  → authorize and inspect content change
  → prepare Workspace revision that opens/focuses target
  → mark entry undoing with operation id
  → invoke idempotent content undo
  → commit/finalize Workspace focus + history cursor
  → undone
```
Recovery examines the content ChangeSet and coordinator operation ID:
- content not undone → retry content operation;
- content undone, Workspace not finalized → finalize reveal;
- access revoked before content mutation → mark blocked, no mutation;
- access revoked after content commit → preserve audit/recovery marker and expose
	an operator-safe repair path; do not leak content.
## Persistence additions
```sql
CREATE TABLE workspace_history_entries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  resource_kind TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  changeset_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  before_revision INTEGER NOT NULL,
  after_revision INTEGER NOT NULL,
  reveal_json TEXT NOT NULL,
  state TEXT NOT NULL,
  operation_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, action_id)
);

CREATE INDEX idx_workspace_history_cursor
  ON workspace_history_entries(workspace_id, created_at, id);
```
Workspace snapshot stores undo/redo cursors or stack entry IDs, not duplicated
content ChangeSets.
## HTTP surface
```javascript
GET  /workspace/history?cursor=:cursor&limit=:limit
POST /workspace/history/undo
POST /workspace/history/redo
GET  /workspace/history/operations/:operationID
```
Commands include Workspace base revision, target history entry, and
idempotency key. Success returns both the new Workspace revision and the content
revision.
## Ordered implementation tasks
1. Freeze history entry, reveal destination, state machine, redo invalidation,
	and error schemas.
2. Implement `ContentHistoryPort` conformance tests and adapt Document.
3. Add Spreadsheet, Slides, and Chat adapters.
4. Add Workspace history persistence, cursor, and idempotent coordinator.
5. Add same-database transaction runner or durable saga/recovery loop.
6. Add reveal/focus/selection/lens restoration with typed fallback when a saved
	selection no longer resolves.
7. Add routes, operation modes, events, pagination, redaction, and access checks.
8. Add crash injection at every state transition and backend-only multi-editor
	E2E.
9. Update architecture companions and the implementation record.
## Security, concurrency, jobs, and observability
- Re-authorize the Resource through the same caller-aware access port as direct
	reads; undisclosing errors do not reveal inaccessible IDs.
- Never serialize Resource content into Workspace history.
- Serialize commands per Workspace and use content revision CAS.
- Recovery work is Project-scoped, lease-based, retry-bounded, and idempotent.
- A closed SSE/client connection does not cancel a durable coordinator operation.
- Emit operation state/duration/recovery, Resource kind, reopen count, conflicts,
	blocked reason, stale selection fallback, and stack depth; no content.
## Verification
- Port conformance for all four Resources.
- Undo/redo visible-open and closed-tab cases.
- Closed tab reopens before/with mutation and response focus is correct.
- Selection/lens restoration and deleted-object fallback.
- Resource deleted, trashed, archived, or access revoked at each state.
- Crash/restart after every transition; no double undo/redo.
- Concurrent new edit invalidates redo per contract.
- Multi-client same user/Workspace CAS conflicts resolve without lost tabs.
- Backend E2E spans Document → Spreadsheet → Slides → Chat, closes tabs, then
	walks undo/redo with restart between steps.
## Migration and rollback
Add the table and adapters after Ω-012. Existing Workspace snapshots begin with
an empty unified stack; do not synthesize history from ambiguous UI state.
Document-local history remains usable during rollout. Rollback disables unified
commands but does not delete Resource ChangeSets. In-progress coordinator rows
must be drained or recovered before binary rollback.
## Completion evidence
- Conformance, crash, race, negative-security, and multi-resource E2E pass.
- A trace proves no undo mutates a Resource without a revealable tab transition.
- Recovery table is empty after the test suite and a forced restart drill.
- Alpha receives stable Workspace/content revision contracts.
## Sources
- Taurus Yesod Model — Workspace capability
- Workspace backend and frontend implementation plans
- `core/capability/workspace`
- `core/capability/document` history
- Ω-021–Ω-026 resource history contracts
- `core/wiring/wiring.go`

