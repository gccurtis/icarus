---
title: "Work Packet — Ω-027 — Extend Workspace history coordination to every resource"
notion_page_id: "3acb6410e50281e5a7b8f2ff2506c397"
notion_url: "https://app.notion.com/3acb6410e50281e5a7b8f2ff2506c397"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:59:38Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-027 — Extend Workspace history coordination to every resource

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

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

