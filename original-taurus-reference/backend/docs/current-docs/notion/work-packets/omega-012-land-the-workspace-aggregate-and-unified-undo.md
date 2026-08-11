---
title: "Work Packet — Ω-012 — Land the Workspace aggregate and unified undo"
notion_page_id: "3acb6410e50281c5a79ff934a7c64058"
notion_url: "https://app.notion.com/3acb6410e50281c5a79ff934a7c64058"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:57:56Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-012 — Land the Workspace aggregate and unified undo

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

## Outcome
Replace the opaque Workspace blob with the typed, revisioned user×Project aggregate defined by the current Workspace Primary. The aggregate canonically persists system, launcher, and Resource tabs; active tab; workspace-wide panel geometry; per-tab Context, Inspector, target, and Resource-view envelopes; and immutable private shell history.
Workspace also owns the unified undo coordinator that arbitrates between shell history and the visible active Resource’s history. Undo never mutates hidden content: a later shell action is compensated first, and a Resource target must be mounted and revealed before its content compensation can run.
Workspace is personal shell state hosted through the user’s `(UserID, ProjectID)` Project Subcell. It is not itself a backend cell or a shared Project runtime.
## As-built evidence
Omega currently persists Workspace as an opaque GET/PUT blob in the legacy `workspaces` table. The server cannot validate tab identity, bound view state, perform revision CAS, explain conflicts, or coordinate shell and Resource history. Alpha currently treats local storage and a whole-state PUT as stronger authority than the target contract.
The implementation authority is [Model — Workspace Capability & Runtime Contract](https://app.notion.com/p/3acb6410e50281ddaa6dca8f6e1802fb). This packet implements that model rather than retaining older packet-era adaptations.
Settled corrections:
- create `workspace_aggregates`, `workspace_change_sets`, and `user_project_action_heads`; do not repurpose the legacy table;
- use only `system | launcher | resource` tab kinds;
- model Overview and Project Agents as registry-owned system views, New Tab as a launcher, and file/media preview as a Resource adapter;
- preserve a launcher’s Tab ID when it resolves into a Resource;
- make deliberate open, close, resolve, activate, and reorder actions undoable;
- keep width, viewport, panel, disclosure, and lens-memory synchronization revisioned but outside user undo;
- order Workspace and Resource undo with a monotonic user×Project `ActionStamp.Seq`, never wall-clock timestamps;
- emit Ω-014 Project change descriptors/revisions as invalidations, not full projection events;
- use `SubmissionID` as the one durable command-idempotency identity.
## Scope
- Define `Workspace`, resolved `Base`, `ChromeState`, `Tab`, `TabViewState`, bounded `ViewState`, `TargetRef`, immutable `ChangeSet`, and `ActionStamp` exactly as the Primary specifies.
- Persist one default Workspace slot per user×Project while retaining a stable Workspace ID and `SlotKey = "default"`.
- Provide explicit read, submit, undo, redo, history, and reveal-confirmation contracts with revision CAS.
- Validate Resource visibility and membership before accepting Resource intent.
- Bound tab count, target depth, lens IDs, view envelopes, and complete resolved Base size.
- Implement deterministic shell inverses and unified visible-content undo through a narrow `ContentHistoryPort` wired outside capabilities.
- Migrate valid legacy blobs on first typed read and park the old table through the rollback window.
- Publish durable change descriptors for multi-client convergence.
## Non-goals
- No cross-user shared tabs or shared Workspace layouts.
- No Workspace aggregate at user-library landing surfaces.
- No content undo for an inactive or hidden Resource.
- No non-Document Resource history until that capability implements `ContentHistoryPort`; Ω-027 completes the registry.
- No user-visible undo entries for panel widths, viewport/scroll, disclosure, lens memory, or other sync-only view state.
- No pin/unpin command: system tabs are pinned by the static registry and cannot close.
- No position-based tab identity, timestamp-based undo arbitration, silent history rewriting, or full-state last-write-wins.
- No long-lived dual-write mode or Alpha layout redesign.
## Governing model
```go
type Workspace struct {
    ID        string
    UserID    string
    ProjectID string
    SlotKey   string // "default" in V1
    Base      Base
    Revision  int64
    UpdatedAt time.Time
}

type Base struct {
    SchemaVersion int
    Tabs          []Tab
    ActiveTabID   string
    Chrome        ChromeState
}

type TabKind string

const (
    TabSystem   TabKind = "system"
    TabLauncher TabKind = "launcher"
    TabResource TabKind = "resource"
)

type Tab struct {
    ID       string
    Kind     TabKind
    System   *SystemRef
    Launcher *ViewState
    Resource *ResourceRef
    View     TabViewState
    OpenedAt time.Time
}

type SystemRef struct {
    ViewID string // overview, agents; Alpha registry-owned
}

type ResourceRef struct {
    Kind string
    ID   string
}
```
Exactly one of System, Launcher, or Resource matches the tab kind. Exactly one Overview system tab exists. System tabs are deterministic, pinned in registry order, and non-closeable. A Resource may have at most one tab in the Workspace.
Ω-012 may initially construct Overview before Ω-019 supplies the Project Agents capability, but it must already recognize `agents` as a Project system view and must never describe it as equivalent to user-level `/library/agents`. Ω-019 adds or repairs the permanent Agents tab through the typed system-tab rollout. Legacy migration preserves valid Overview and Agents tabs as system tabs.
Spreadsheet Resource view or Inspector envelopes use the one-grid Spreadsheet authority: SpreadsheetID plus stable RowID, ColumnID, CellID, and RangeRef identities. They never introduce `sheetId` or sheet-tab state.
## Command model
Public submissions carry `SubmissionID`, `ExpectedRevision`, optional Session/undo-group metadata, and a closed operation list:
```go
const (
    OpOpenResource    OperationType = "open_resource"
    OpOpenLauncher    OperationType = "open_launcher"
    OpResolveLauncher OperationType = "resolve_launcher"
    OpActivateTab     OperationType = "activate_tab"
    OpCloseTab        OperationType = "close_tab"
    OpCloseOthers     OperationType = "close_others"
    OpCloseRight      OperationType = "close_right"
    OpMoveTabs        OperationType = "move_tabs"
    OpSetChrome       OperationType = "set_chrome"
    OpSetPanelView    OperationType = "set_panel_view"
    OpSetResourceView OperationType = "set_resource_view"
    OpRevealTarget    OperationType = "reveal_target"
)
```
Rules:
- `open_resource` activates an existing matching Resource tab rather than duplicating it.
- `open_launcher` creates a stable transitional tab.
- `resolve_launcher` changes that same Tab ID into a Resource tab atomically. If the Resource is already open, the launcher closes and the existing tab activates; its private inverse restores the launcher and prior active state.
- `move_tabs` names moved Tab IDs plus a stable `BeforeTabID`; an empty anchor means the end. Moving into the pinned system region is rejected.
- `set_panel_view` and `set_resource_view` persist bounded, versioned envelopes without importing Alpha’s registries.
- an accepted no-op still advances the revision but cannot hide an older undo candidate.
- accepted ChangeSets remain immutable. `UndoGroupID` may group operations from one semantic action; V1 does not silently collapse unrelated tab clicks.
Open, launcher, resolve, activate, close, bulk close, and move operations are `HistoryUndoable` when they produce a real inverse. Geometry, panels, Resource views, reveal-only state, and authoritative access reconciliation are `HistorySyncOnly`.
## Unified undo
Every undoable Workspace or Resource action receives a monotonic user×Project action sequence. Workspace projects it as:
```go
type ActionStamp struct {
    Seq        int64
    AcceptedAt time.Time
}
```
`AcceptedAt` is diagnostic. `ActionStamp.Seq` alone decides chronology. Workspace depends on a narrow `ContentHistoryPort`; Document, Spreadsheet, Slides, and Chat do not import Workspace.
The coordinator:
1. reads the newest eligible private Workspace candidate for the caller;
2. asks only the active Resource’s registered history provider for its candidate;
3. chooses the greatest `ActionStamp.Seq`;
4. compensates a newer shell action before older content;
5. requires the exact stable Resource target to be visible before content mutation;
6. returns a short-lived reveal continuation when the active Resource is correct but the target is not yet visible;
7. rechecks Workspace and Resource heads when Alpha confirms the reveal.
Example: edit A → activate B → Undo activates A; the following Undo reveals and compensates the edit. Edit A → close A → Undo restores/selects A; the following Undo may compensate its content. Undo never chooses a closed or inactive Resource directly.
## Persistence and migration
Use the exact tables and constraints from the Workspace Primary:
- `workspace_aggregates` stores the complete resolved current Base and revision by stable Workspace ID and unique user×Project×slot;
- `workspace_change_sets` stores immutable accepted intent, private inverse, Submission hash, Workspace sequence, history class, undo/redo lineage, and optional Action sequence;
- `user_project_action_heads` allocates monotonic ordering shared by the caller’s Workspace and Resource histories.
Append performs revision CAS, idempotency lookup/hash verification, ChangeSet insert, resolved Base replacement, and head revision update atomically. Reads never replay ChangeSets to reconstruct the Base.
First-read migration:
1. return the typed aggregate when it already exists;
2. otherwise decode the legacy blob transactionally;
3. preserve valid stable Tab IDs/order and deduplicate accessible Resources;
4. convert Overview and Agents to system tabs and New Tab to a launcher where recognizable;
5. migrate former global widths to Chrome and seed bounded per-tab view state;
6. use a clean default only for absent or structurally malformed legacy state;
7. treat database, metadata, or temporary access-resolution failures as errors, never silent replacement;
8. stop legacy writes after compatible Alpha/Omega cutover and retain the old table through rollback.
## API and delivery
```plain text
GET  /workspace?slot=default&knownRevision=...
POST /workspace/changes
POST /workspace/history/undo
POST /workspace/history/redo
POST /workspace/history/confirm
GET  /workspace/history?limit=...&cursor=...
```
The authenticated access gate supplies User and explicit Project scope. Request JSON cannot retarget either.
Mutation responses may return the authoritative resulting projection. Ω-014 delivery carries a durable Project change descriptor/cursor and relevant revision identity; Alpha then fetches the Workspace projection when required. Wakeups are hints and duplicate descriptors are harmless.
## Ordered implementation
1. Freeze Primary-aligned codecs, bounds, operation vocabulary, private inverse rules, deterministic system IDs, and golden fixtures.
2. Add the three typed tables and shared Memory/SQLite store contract without changing the legacy table.
3. Implement strict Base validation, deterministic Overview construction, and registry-compatible system-tab handling.
4. Implement the pure reducer, stable-anchor movement, launcher resolution, history classification, and exact inverses.
5. Implement CAS append and `SubmissionID` replay/hash-conflict behavior.
6. Put the history coordinator under Workspace and wire Document through `ContentHistoryPort` without capability imports.
7. Implement Action-sequence arbitration and reveal-before-content continuation.
8. Add safe first-read migration and compatible Alpha typed clients after Ω-011.
9. Emit Ω-014 invalidation descriptors and remove the legacy PUT from supported transport.
10. Integrate Ω-018 Overview, Ω-019 Project Agents, and Ω-027 Resource history providers at their packet boundaries.
11. Update backend guide, Alpha contract, companion docs, completion matrix, and change record.
## Security, concurrency, and observability
Workspace load and mutation predicates include Workspace ID, authenticated User, and explicit Project. Resource/target admission uses Ω-009 caller-aware access. Authoritative loss of access produces a revisioned, sync-only removal without leaking cached titles; transient infrastructure failures preserve the Base.
Every accepted command carries expected revision and one durable `SubmissionID`. A transport RequestID is tracing only. Conflicts return current revision plus bounded safe rebase information; the system never last-write-wins the full Base.
Metrics include operation kind, revision conflict, migration disposition, aggregate size, tab count, history provider, reveal continuation, recovery count, and latency. Logs omit Resource titles, view-state bodies, selected text, and private inverses.
## Tests and gates
- strict codec, size/depth, hostile JSON, and whole-Base invariant tests;
- Memory/SQLite parity for CAS, Submission replay/hash conflict, immutable history, undo/redo lineage, and migration rerun;
- system/launcher/Resource kind and exactly-one-field tests;
- deterministic Overview ID; pinned/non-closeable system tabs; Agents compatibility and Ω-019 rollout;
- launcher resolution preserves Tab ID and handles Resource collision;
- stable before-anchor move, pinned-region refusal, and undoable reorder;
- sync-only panel/view updates never intercept content undo;
- Action-sequence cases: shell newer, content newer, invalid equal sequence, no history;
- edit A → activate B → Undo; edit A → close A → Undo; bulk close; grouped navigation;
- inaccessible, deleted, missing, and temporarily unavailable targets;
- reveal continuation expiry and head-change rejection;
- multi-client conflict/rebase and `go test -race`;
- legacy valid, absent, corrupt, oversized, hidden-target, and concurrent-migration fixtures;
- backend E2E restart/resume, two sessions, Ω-014 cursor recovery, and Alpha keyboard undo focus.
## Completion evidence
- Opaque Workspace PUT is removed from the supported contract.
- The stored Base uses only system, launcher, and Resource tabs.
- Launcher resolution and Resource reopening preserve stable identity.
- Reordering is undoable; view/panel synchronization is not.
- Cross-capability chronology uses Action sequence, not timestamps.
- Undo cannot mutate invisible content.
- Multi-client/restart tests prove typed persistence and convergence.
- New typed state exists only in the new tables; legacy data remains parked through rollback.
- Workspace and Resource capabilities remain isolated and integrate only through wiring ports.
## Dependencies
Depends on Ω-010 and Ω-011. Initially integrates Document history. Blocks Ω-013, Ω-014, Ω-017, Ω-018, Ω-019, and Ω-027.
## Sources
- [Model — Workspace Capability & Runtime Contract](https://app.notion.com/p/3acb6410e50281ddaa6dca8f6e1802fb)
- [Implementation — Workspace Backend](https://app.notion.com/p/3acb6410e5028138917ff768d9776e8e)
- [Implementation — Workspace Frontend](https://app.notion.com/p/3acb6410e50281d2813fe9f261c35ac4)
- [Architecture — User Cell & Project Subcell Runtime](https://app.notion.com/p/3acb6410e5028147909ef7214406baad)
- [Architecture — Workbench Shell, Workspace & Stage Lifecycle](https://app.notion.com/p/3adb6410e50281b88424fd8694de4740)
- [Architecture — Frontend Synchronization, Replicas & Reconciliation](https://app.notion.com/p/3adb6410e502815497b0e1c1c60ef284)

