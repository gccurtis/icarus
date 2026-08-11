---
title: "Model — Workspace Capability & Runtime Contract"
notion_page_id: "3acb6410e50281ddaa6dca8f6e1802fb"
notion_url: "https://app.notion.com/3acb6410e50281ddaa6dca8f6e1802fb"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 15:26:25Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Model — Workspace Capability & Runtime Contract

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Status:** Implementation-ready Taurus Yesod authority. This contract supersedes the opaque workspace blob currently implemented in Taurus Omega and the project-global panel state currently implemented in Taurus Alpha. It preserves the useful shell behavior already present while changing either repository where the stronger model requires it.
>
> **Frontend refinement:** <mention-page url="https://app.notion.com/p/3adb6410e502818fb987d5f5004117e3"/> now governs Alpha’s panel runtime. Context uses the persisted user-chosen lens ID. Inspector is one adaptive selection-driven surface: Workspace persists collapse/open state, a stable target, and bounded state envelopes; any `ActiveLensID` in the shared storage shape is reserved for a stable mode such as `selection`, not a fixed facet registry. Temporary AI takeover is ephemeral and restores the stable selection.
## 1. Outcome
Workspace is a private, durable, revisioned aggregate for one user inside one project. It remembers:
- the stable identity, order, kind, and resource binding of every open tab;
- the active tab;
- workspace-wide panel geometry;
- each tab's Context lens, panel collapse state, stable Inspector target/mode envelope, and resource-specific viewport;
- enough immutable shell history to undo and redo navigation without ever mutating content the user cannot see;
- the state required to reopen the project after sign-out, process restart, browser restart, or another device session.
Workspace does **not** own document, spreadsheet, slides, chat, project, resource, comment, task, or agent content. It stores references and bounded view state, then reaches those capabilities only through wiring ports.
The core rule is:
> A content undo may execute only for the resource mounted in the active tab, and only after its stable target has been revealed. If a later shell action hid or closed that target, undo compensates the shell action first.
## 2. Governing decisions
1. **Omega is authoritative.** Browser state is an optimistic projection and boot cache, never the durable source of truth.
2. **One default workspace per user × project in V1.** A stable `WorkspaceID` and `SlotKey = "default"` leave room for named layouts later.
3. **Resolved head Base + immutable ChangeSets + logical revision.** Every accepted persistent mutation atomically persists the complete resolved next Base and increments the Workspace revision. ChangeSets are history and compensation records; reads never replay them to reconstruct state.
4. **No last-write-wins replacement.** Commands carry `ExpectedRevision` and `SubmissionID`; conflicts refetch and deliberately replay safe intent.
5. **Tabs own their view memory.** The active Context lens, panel collapse, stable Inspector target/mode envelope, and editor viewport travel with the tab. Panel widths are workspace-wide. Inspector sections themselves are resolved at runtime from selection.
6. **Resource tabs are identity-based.** A resource has at most one tab in a workspace. Position, ordinal, and title are projections, never identity.
7. **Accepted history is immutable.** Consecutive navigation may share an `UndoGroupID`; the server never rewrites an already accepted head ChangeSet to collapse history.
8. **Only deliberate shell actions enter undo.** Open, close, resolve, activate, and reorder are undoable. Width, viewport, scroll, disclosure, and lens-memory sync are durable but not undo candidates.
9. **Undo ordering is deterministic across capabilities.** Every undoable user action and every user-directed undo/redo compensation receives a monotonic action sequence scoped to user × project. Workspace projects that sequence as an `ActionStamp`; Resource capabilities store their own primitive `AuthorActionSeq` and do not import Workspace. The coordinator compares sequences without copying Resource history into Workspace.
10. **Workspace history is private.** It is not project activity and is never visible to collaborators. Presence and caret telemetry remain in Session.
11. **No staleness or count cutoff in V1.** History remains available while its referenced Resource history and stable targets remain retained. No storage checkpoint may silently make an otherwise eligible action unavailable to undo.
12. **Backend navigation uses the same commands.** An agent or completed task may request a tab open or reveal for its initiating user, but it receives no bypass around validation, revisioning, or undo.
13. **Lens registration is Alpha-owned.** Omega persists only bounded, syntactically valid lens IDs and versioned envelopes. It does not mirror Alpha's panel registry or depend on a permissive `LensPolicy`. Alpha validates availability for the mounted surface and renders its local default when a stored ID is unknown.
14. **The reducer has no infrastructure I/O.** Resource membership, access, and metadata resolution belong to the service admission and reconciliation layers. `Apply` operates only on data plus deterministic ID and clock dependencies.
15. **Authoritative loss of access is a revisioned reconciliation.** A confirmed deletion or denial removes the Resource tab through a sync-only system ChangeSet and activates Overview when necessary. A timeout, database failure, or temporarily unavailable metadata provider fails the request and never deletes durable Workspace state.
## 3. Boundary and ownership
### Durable Workspace state
- Workspace identity, owner, project, and slot.
- Ordered system, launcher, and resource tabs.
- Active tab.
- Workspace-wide context and inspector widths.
- Per-tab active Context lens ID, panel collapsed state, and bounded Inspector target/mode envelope.
- Per-tab stable target references.
- Bounded per-lens disclosure, sort, filter, and scroll anchors.
- Bounded resource viewport state such as a document anchor, Spreadsheet row/column anchors, active slide, zoom, or Chat turn.
- Immutable Workspace ChangeSets, inverses, undo/redo lineage, and action stamps.
### Durable Resource state
- Document rows, blocks, atoms, styles, and page layout.
- Spreadsheet’s one sparse grid: rows, columns, cells, formulas, ranges, overlays, charts, and images.
- Slides sections, slides, objects, text, notes, templates, and geometry.
- Chat turns, prompts, responses, attachments, and generation state.
- Resource names and lifecycle.
### Ephemeral Session state
- Presence and collaborator focus.
- Caret offsets and live text selection.
- Hover, drag, resize-in-progress, pointer position, IME composition, and transient dialogs.
- Unsaved prompt drafts and free-form search text.
- Pending optimistic operations not yet accepted by Omega.
### Local cache
Alpha may mirror the last acknowledged Workspace projection for fast first paint. The cache:
- is versioned by schema, `WorkspaceID`, project, user, and revision;
- clears on sign-out; on Project switch, active runtime pointers and transients reset while acknowledged cache records remain strictly partitioned by user and Project under cache policy;
- never overrides a newer server revision;
- contains no credentials, resource bodies, selected text, prompt drafts, or unrestricted search text.
## 4. Aggregate model
```go
package workspace

type Workspace struct {
    ID        string    `json:"id"`
    UserID    string    `json:"-"`
    ProjectID string    `json:"projectId"`
    SlotKey   string    `json:"slotKey"` // "default" in V1
    Base      Base      `json:"base"`
    Revision  int64     `json:"revision"`
    UpdatedAt time.Time `json:"updatedAt"`
}

type Base struct {
    SchemaVersion int         `json:"schemaVersion"`
    Tabs          []Tab       `json:"tabs"`
    ActiveTabID   string      `json:"activeTabId"`
    Chrome        ChromeState `json:"chrome"`
}

type ChromeState struct {
    ContextWidthPx   int `json:"contextWidthPx"`
    InspectorWidthPx int `json:"inspectorWidthPx"`
}

type TabKind string

const (
    TabSystem   TabKind = "system"
    TabLauncher TabKind = "launcher"
    TabResource TabKind = "resource"
)

type Tab struct {
    ID       string       `json:"id"`
    Kind     TabKind      `json:"kind"`
    System   *SystemRef   `json:"system,omitempty"`
    Resource *ResourceRef `json:"resource,omitempty"`
    Launcher *ViewState   `json:"launcher,omitempty"`
    View     TabViewState `json:"view"`
    OpenedAt time.Time    `json:"openedAt"`
}

type SystemRef struct {
    ViewID string `json:"viewId"` // overview, agents; registry-owned
}

type ResourceRef struct {
    Kind string `json:"kind"` // document, spreadsheet, slides, chat, ...
    ID   string `json:"id"`
}

type TabViewState struct {
    Context   PanelViewState `json:"context"`
    Inspector PanelViewState `json:"inspector"`
    Resource  ViewState      `json:"resource"`
}

type PanelViewState struct {
    Collapsed    bool        `json:"collapsed"`
    ActiveLensID string      `json:"activeLensId"`
    Target       *TargetRef  `json:"target,omitempty"`
    Lenses       []LensState `json:"lenses,omitempty"`
}

type LensState struct {
    LensID string    `json:"lensId"`
    State  ViewState `json:"state"`
}

// ViewState is opaque only inside a typed, versioned, bounded envelope.
// Workspace validates the envelope; the owning Alpha adapter validates Data.
// Nil Data is encoded as an absent key. An explicit raw JSON null remains an
// adapter-defined opaque payload; no nested custom unmarshaler weakens strict
// decoding of the envelope.
type ViewState struct {
    Kind          string          `json:"kind"`
    SchemaVersion int             `json:"schemaVersion"`
    Data          json.RawMessage `json:"data,omitempty"`
}

type TargetRef struct {
    Resource ResourceRef     `json:"resource"`
    Kind     string          `json:"kind"`
    Path     []TargetSegment `json:"path"`
}

type TargetSegment struct {
    Kind string `json:"kind"`
    ID   string `json:"id"`
}
```
Representative stable targets:
```json
{
  "resource": {"kind": "document", "id": "doc_42"},
  "kind": "text",
  "path": [
    {"kind": "row", "id": "row_7"},
    {"kind": "block", "id": "block_18"},
    {"kind": "atom", "id": "atom_3"}
  ]
}
```
```json
{
  "resource": {"kind": "spreadsheet", "id": "spreadsheet_9"},
  "kind": "range",
  "path": [
    {"kind": "range", "id": "range_q3_assumptions"}
  ]
}
```
A Taurus Spreadsheet is one sparse grid and has no nested sheets or sheet tabs. The adapter persists a stable RangeRef and may include RowID, ColumnID, or CellID segments where the target requires them. A1 notation is a revision-bound display projection and is never identity.
## 5. Invariants
`ValidateBase` enforces the structural rules that can be decided from the aggregate alone. Service admission and reconciliation enforce project membership, Resource existence, and access. Alpha surface adapters enforce mounted-lens registration. Together they maintain these rules:
1. `SchemaVersion` is supported.
2. Every Tab ID is unique, non-empty, server-issued, and stable. System IDs are deterministic: the fixed registry entry `viewID` maps to `tab_system_` + `viewID`.
3. Exactly one system Overview tab exists.
4. System tabs are pinned in registry order and cannot close.
5. `ActiveTabID` resolves to one tab.
6. At most one resource tab exists for each `(Resource.Kind, Resource.ID)`.
7. Exactly one of `System`, `Resource`, or `Launcher` matches `Tab.Kind`.
8. Every Resource reference introduced or acted upon belongs to the selected project and is accessible to the user. The service enforces this before `Apply`; authoritative access reconciliation covers references already present in the Base.
9. Every persisted lens ID is non-empty, syntactically valid, and bounded. Registration against the currently mounted surface is an Alpha responsibility: an unknown stored ID renders as the adapter's first supported lens without making the Workspace structurally invalid.
10. Inspector and resource targets match the tab's Resource reference.
11. A stale target degrades to resource-level selection; it never resolves by ordinal to a different object.
12. Widths, tab count, path depth, lens count, and every opaque payload are bounded.
13. Resource titles are not stored as truth. The response projection resolves current names through the Resource metadata port.
14. Loss of access never leaks a cached title. A confirmed `resource_forbidden` or `resource_not_found` result causes an explicit, persisted, sync-only system reconciliation that removes the tab and repairs `ActiveTabID` to Overview when needed. Transient infrastructure or metadata failures do not mutate the Workspace.
Recommended bounds:
```go
const (
    MaxTabs                = 64
    MaxLensStatesPerPanel  = 24
    MaxLensIDBytes         = 128
    MaxTargetDepth         = 8
    MaxViewStateBytes      = 16 << 10 // per envelope
    MaxResolvedBaseBytes   = 256 << 10
    MinContextWidthPx      = 220
    MaxContextWidthPx      = 420
    MinInspectorWidthPx    = 240
    MaxInspectorWidthPx    = 480
)
```
## 6. Command model
All external mutations enter through one closed operation vocabulary:
```go
type OperationType string

const (
    OpOpenResource   OperationType = "open_resource"
    OpOpenLauncher   OperationType = "open_launcher"
    OpResolveLauncher OperationType = "resolve_launcher"
    OpActivateTab    OperationType = "activate_tab"
    OpCloseTab       OperationType = "close_tab"
    OpCloseOthers    OperationType = "close_others"
    OpCloseRight     OperationType = "close_right"
    OpMoveTabs       OperationType = "move_tabs"
    OpSetChrome      OperationType = "set_chrome"
    OpSetPanelView   OperationType = "set_panel_view"
    OpSetResourceView OperationType = "set_resource_view"
    OpRevealTarget   OperationType = "reveal_target"
)

type Submission struct {
    SubmissionID     string      `json:"submissionId"`
    ExpectedRevision int64       `json:"expectedRevision"`
    SessionID        string      `json:"sessionId,omitempty"`
    UndoGroupID      string      `json:"undoGroupId,omitempty"`
    Operations       []Operation `json:"operations"`
}
```
Operation intent:
- `open_resource` validates the Resource reference. If it is already open, it activates the existing tab rather than creating a duplicate.
- `open_launcher` creates a stable transitional tab.
- `resolve_launcher` atomically changes that same Tab ID into a Resource tab. Components keyed by Tab ID do not remount solely because creation completed. If that Resource is already open, the launcher closes and the existing Resource tab activates; the inverse restores the launcher and prior active tab.
- `activate_tab` changes only focus.
- `close_tab`, `close_others`, and `close_right` atomically record removed tabs, their order, full bounded view state, and the prior active tab in the private inverse. Closing the active tab activates the nearest previous closeable tab, otherwise the nearest following closeable tab, otherwise Overview.
- `move_tabs` inserts the moved Tab IDs immediately before `BeforeTabID`, preserving their relative order; an empty anchor means the end. A move into the pinned system region is rejected rather than clamped. The operation never submits a title or positional identity.
- `set_chrome` updates only bounded workspace-wide widths.
- `set_panel_view` updates one tab and one side. It may select a lens, collapse it, persist a stable target, or replace one bounded lens envelope.
- `set_resource_view` replaces one adapter-owned bounded viewport envelope.
- `reveal_target` is normally server-initiated by undo or agent navigation and updates the target/view projection without editing resource content.
Resource-access reconciliation is service-owned, not public client intent. After an authoritative `resource_forbidden` or `resource_not_found` result, the service may mint a private `remove_inaccessible_tab` operation naming the exact Tab ID and expected Resource reference. It removes the tab, repairs focus to Overview when needed, and is persisted as a system-authored `HistorySyncOnly` ChangeSet with no ActionStamp and no user-undoable inverse. Public JSON cannot submit this operation. Reconciliation runs transactionally before returning an authoritative projection or admitting a new submission; a concurrent head change causes a reload and re-evaluation.
The server computes whether a ChangeSet is undoable:
```go
func HistoryClass(op OperationType) HistoryClass {
    switch op {
    case OpOpenResource, OpOpenLauncher, OpResolveLauncher,
         OpActivateTab, OpCloseTab, OpCloseOthers, OpCloseRight,
         OpMoveTabs:
        return HistoryUndoable
    default:
        return HistorySyncOnly
    }
}
```
A submission's provisional `HistoryClass` is the strongest class among its operations. After reduction, a batch with an empty inverse is `HistorySyncOnly`: an accepted no-op remains durable and revisioned but cannot become an undo step that hides earlier real actions. Otherwise, if any operation is undoable, the atomic batch is undoable and its inverse compensates the entire batch. Clients should submit unrelated sync-only state separately when it should not ride inside that undo step.
High-frequency view updates may be coalesced before admission, but once accepted they are immutable revisions.
## 7. Pure reducer and inverse generation
The service resolves and authorizes Resource references before reduction and performs authoritative access reconciliation separately. The reducer performs no network, database, authorization, or metadata I/O. It deep-copies the Base, applies operations in order, and returns the exact private inverse plus a reveal footprint:
```go
type ApplyDeps struct {
    IDs   IDSource
    Clock Clock
}

func Apply(
    before Base,
    operations []Operation,
    deps ApplyDeps,
) (after Base, inverse []Operation, footprint Footprint, err error) {
    after = before.DeepCopy()
    for _, op := range operations {
        inv, part, err := applyOne(&after, op, deps)
        if err != nil {
            return Base{}, nil, Footprint{}, err
        }
        // Reverse operation order when constructing compensation.
        inverse = append(inv, inverse...)
        footprint.Merge(part)
    }
    Normalize(&after)
    if err := ValidateBase(after); err != nil {
        return Base{}, nil, Footprint{}, err
    }
    return after, inverse, footprint.Normalize(), nil
}
```
For a fixed `before`, operation list, and deterministic dependencies, `Apply` is deterministic. Resource authorization errors such as `resource_forbidden` are service errors and never reducer errors.
Private inverse operations may carry exact restored Tab snapshots and prior panel/view envelopes. They are never accepted from public JSON. In particular, the inverse of private `restore_tabs` is private `remove_tabs`, which names stable Tab IDs rather than array positions and may bypass the public closeability rule. Only reducer-generated private compensation may mint it. This makes bulk close, redo-after-close, and launcher resolution exactly reversible without expanding the external command surface.
## 8. ChangeSet, concurrency, and idempotency
```go
type ActionStamp struct {
    Seq        int64     `json:"seq"`
    AcceptedAt time.Time `json:"acceptedAt"`
}

type ChangeSet struct {
    ID               string      `json:"id"`
    WorkspaceID      string      `json:"workspaceId"`
    AuthorID         string      `json:"authorId"`
    SessionID        string      `json:"sessionId,omitempty"`
    ActorKind        string      `json:"actorKind"` // user | agent | system
    SubmissionID     string      `json:"submissionId"`
    SubmissionHash   string      `json:"-"`
    AuthoredRevision int64       `json:"authoredRevision"`
    PriorRevision    int64       `json:"priorRevision"`
    Seq              int64       `json:"seq"`
    Operations       []Operation `json:"operations"`
    Inverse          []Operation `json:"-"`
    HistoryClass     HistoryClass `json:"historyClass"`
    UndoGroupID      string      `json:"undoGroupId,omitempty"`
    Action           *ActionStamp `json:"action,omitempty"`
    UndoOf           string      `json:"undoOf,omitempty"`
    RedoOf           string      `json:"redoOf,omitempty"`
    CreatedAt        time.Time   `json:"createdAt"`
}
```
Admission:
```go
func (s *Service) Submit(
    ctx context.Context,
    scope Scope,
    actor Actor,
    sub Submission,
) (Workspace, ChangeSet, error) {
    normalized, hash, err := ValidateAndHash(sub)
    if err != nil {
        return Workspace{}, ChangeSet{}, err
    }
    if prior, ok, err := s.retry(ctx, scope, sub.SubmissionID); err != nil {
        return Workspace{}, ChangeSet{}, err
    } else if ok {
        if prior.SubmissionHash != hash {
            return Workspace{}, ChangeSet{}, ErrSubmissionConflict
        }
        return s.Get(ctx, scope)
    }

    head, err := s.store.Workspace(ctx, scope)
    if err != nil {
        return Workspace{}, ChangeSet{}, err
    }
    if head.Revision != sub.ExpectedRevision {
        return Workspace{}, ChangeSet{}, NewRevisionConflict(head.Revision)
    }

    if err := s.validateResourceIntent(ctx, scope, head.Base, normalized.Operations); err != nil {
        return Workspace{}, ChangeSet{}, err
    }
    after, inverse, fp, err := Apply(head.Base, normalized.Operations, ApplyDeps{
        IDs: s.ids, Clock: s.clock,
    })
    if err != nil {
        return Workspace{}, ChangeSet{}, err
    }
    cs := NewChangeSet(head, actor, normalized, hash, inverse, fp, s.now())
    if cs.HistoryClass == HistoryUndoable {
        cs.Action, err = s.actionClock.Next(ctx, scope.UserProject())
        if err != nil {
            return Workspace{}, ChangeSet{}, err
        }
    }
    if err := s.store.Append(ctx, scope, head.Revision, after, cs); err != nil {
        return Workspace{}, ChangeSet{}, TranslateConflict(err)
    }
    return ResolveProjection(after, cs.Seq, s.resources), cs, nil
}
```
V1 uses strict revision CAS for every operation. On conflict, Alpha refetches. It may automatically reissue only identity-idempotent intent such as “ensure this resource is open.” Close, reorder, resolve, and target changes require user intent to remain current and are not blindly replayed.
## 9. Visible-target undo and redo
### 9.1 Resource history port
Workspace does not import Document, Spreadsheet, Slides, or Chat:
```go
type HistoryDirection string

const (
    Undo HistoryDirection = "undo"
    Redo HistoryDirection = "redo"
)

type HistoryCandidate struct {
    ProviderKind string
    Aggregate    ResourceRef
    ChangeSetID  string
    Action       ActionStamp
    Reveal       TargetRef
}

type ContentHistoryPort interface {
    Candidate(
        ctx context.Context,
        scope UserProjectScope,
        active ResourceRef,
        authorID string,
        direction HistoryDirection,
    ) (HistoryCandidate, bool, error)

    Apply(
        ctx context.Context,
        scope UserProjectScope,
        candidate HistoryCandidate,
        continuation Continuation,
    ) (ContentHistoryReceipt, error)
}
```
The coordinator remains inside Workspace and depends only on `ContentHistoryPort`. Wiring owns the Resource-kind registry and adapters, imports Workspace plus the relevant Resource capabilities, and implements that port. Document is the first provider; Spreadsheet, Slides, and Chat join the wiring registry when their history is built. Neither Workspace nor a Resource capability imports another capability.
Every undoable Resource ChangeSet stores the same user-project sequence as a primitive field such as `AuthorActionSeq int64`. User-directed Resource undo/redo compensations also receive fresh action sequences. Each capability may define an identical narrow `ActionClock` port returning primitive values; the shared SQLite implementation satisfies those ports. This adds ordering metadata to Resource history without requiring a Document → Workspace import and without duplicating operations or content in Workspace.
### 9.2 Arbitration
```go
func (u *UndoCoordinator) Plan(
    ctx context.Context,
    scope Scope,
    actor Actor,
    direction HistoryDirection,
    visible *TargetRef,
) (UndoPlan, error) {
    ws, err := u.workspaces.Get(ctx, scope)
    if err != nil {
        return UndoPlan{}, err
    }
    shell, shellOK, err := u.workspaces.Candidate(ctx, scope, actor.ID, direction)
    if err != nil {
        return UndoPlan{}, err
    }

    active := ws.Base.ActiveTab()
    content, contentOK := HistoryCandidate{}, false
    if active.Kind == TabResource {
        content, contentOK, err = u.content.Candidate(
            ctx, scope.UserProject(), *active.Resource, actor.ID, direction,
        )
        if err != nil {
            return UndoPlan{}, err
        }
    }

    candidate, ok := Newest(shell, shellOK, content, contentOK)
    if !ok {
        return UndoPlan{Kind: PlanEmpty}, nil
    }
    if candidate.ProviderKind == "workspace" {
        return u.applyWorkspaceCompensation(ctx, scope, actor, candidate, direction)
    }
    if visible == nil || !Covers(*visible, candidate.Reveal) {
        return u.issueRevealContinuation(ctx, ws, candidate, direction)
    }
    return u.applyContent(ctx, scope, actor, candidate, direction, Continuation{})
}
```
`Newest` compares `ActionStamp.Seq`; a shell candidate wins only if the sequences are identical, which should occur solely through corrupted or legacy data. This replaces timestamp tie heuristics.
Only the active resource is offered to a content provider. An inactive or closed resource can never become a content candidate.
### 9.3 Reveal-before-mutate continuation
When the active resource is correct but the exact target is not visible, Omega returns:
```json
{
  "kind": "reveal_required",
  "direction": "undo",
  "target": {
    "resource": {"kind": "document", "id": "doc_42"},
    "kind": "text",
    "path": [
      {"kind": "block", "id": "block_18"},
      {"kind": "atom", "id": "atom_3"}
    ]
  },
  "continuationToken": "short-lived-server-token"
}
```
Alpha mounts and reveals the target, then confirms with the token. The token binds:
- user, project, workspace, and active Tab ID;
- direction and candidate ChangeSet ID;
- workspace revision and resource head revision;
- reveal target;
- a short expiry.
If either head changes before confirmation, Omega rejects the continuation and replans. Content is never changed merely because a client claims an invisible target.
### 9.4 Required scenarios
**Edit A → select B → Undo**
1. Document A edit receives Action 41.
2. Activating B receives Workspace Action 42.
3. Undo selects Action 42 and activates A; it does not touch content.
4. The next Undo sees A active, reveals the edit target if needed, and compensates Action 41.
**Edit A → close A → Undo**
1. The close ChangeSet stores A's Tab ID, order, lens state, target, viewport, and prior active state.
2. Undo restores that exact tab and makes it active.
3. The content edit remains intact.
4. The next Undo may compensate the content edit.
**Close several tabs**
`close_others` and `close_right` are one ChangeSet each. One Undo restores the complete removed set, relative order, view state, and prior active tab atomically.
**Target deleted or access revoked**
Undo fails closed with a stable `target_unavailable` or `resource_forbidden` result. It never falls back to an ordinal neighbor and never leaks the prior title.
### 9.5 Navigation grouping
An `UndoGroupID` can group multiple immutable Workspace ChangeSets produced by one semantic action—for example, “open generated result” may open, activate, and reveal. Undo compensates the group in reverse order as one shell step.
V1 does not silently group independent tab clicks. A later UX policy may assign one group to a rapid navigation burst, but it must preserve the underlying immutable revisions.
## 10. Persistence
Workspace is small and always loaded as a unit, so the Base may remain structured JSON. ChangeSets remain separate append-only rows:
```sql
CREATE TABLE workspace_aggregates (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    project_id  TEXT NOT NULL,
    slot_key    TEXT NOT NULL DEFAULT 'default',
    revision    INTEGER NOT NULL DEFAULT 0,
    base_json   BLOB NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    UNIQUE (user_id, project_id, slot_key)
);

CREATE TABLE workspace_change_sets (
    id                  TEXT PRIMARY KEY,
    workspace_id        TEXT NOT NULL,
    user_id             TEXT NOT NULL,
    project_id          TEXT NOT NULL,
    seq                 INTEGER NOT NULL,
    submission_id       TEXT NOT NULL,
    submission_hash     TEXT NOT NULL,
    author_id           TEXT NOT NULL,
    session_id          TEXT,
    actor_kind          TEXT NOT NULL,
    authored_revision   INTEGER NOT NULL,
    prior_revision      INTEGER NOT NULL,
    operations_json     BLOB NOT NULL,
    inverse_json        BLOB NOT NULL,
    history_class       TEXT NOT NULL,
    undo_group_id       TEXT,
    action_seq          INTEGER,
    action_accepted_at  TEXT,
    undo_of             TEXT,
    redo_of             TEXT,
    footprint_json      BLOB NOT NULL,
    created_at          TEXT NOT NULL,
    UNIQUE (workspace_id, seq),
    UNIQUE (workspace_id, submission_id),
    FOREIGN KEY (workspace_id) REFERENCES workspace_aggregates(id) ON DELETE CASCADE
);

CREATE INDEX workspace_history_candidate
    ON workspace_change_sets(
        workspace_id, author_id, history_class, seq DESC
    );

CREATE TABLE user_project_action_heads (
    user_id     TEXT NOT NULL,
    project_id  TEXT NOT NULL,
    next_seq    INTEGER NOT NULL,
    PRIMARY KEY (user_id, project_id)
);
```
`base_json` is always the complete resolved Base at the row's current `revision`. It is never a snapshot at an earlier sequence, and a read never replays ChangeSets through `Apply`.
`ActionStamp` persists both `action_seq` and `action_accepted_at`; its sequence orders actions across Resource capabilities, while Workspace history paging and candidate retrieval use the Workspace-local, total `seq` order. The Store verifies the Workspace/ChangeSet relationship on every append. SQLite foreign-key enforcement remains disabled for the shared connection in V1, so the declarative foreign key is schema intent rather than the sole runtime defense; enabling it is a separate global-storage policy decision.
`Append` performs revision CAS, ChangeSet insert, head revision update, and replacement of `base_json` with the resolved `nextBase` in one SQLite transaction. The ChangeSet records accepted public intent plus its concrete, private inverse; it is not a state-reconstruction log.
Undo and redo apply stored private compensation operations against the current resolved head and append new compensating ChangeSets. They must never reapply an ID-allocating public operation such as `open_resource`: concrete Tab snapshots in private operations preserve the original stable IDs.
There is no `BaseSeq`, state fold, replay path, or count-based undo watermark in V1. History eligibility derives from `HistoryClass`, author, action order, undo/redo lineage, grouping, and current inverse preconditions—not from a storage sequence threshold. Immutable ChangeSets remain retained and queryable. A future explicit history-retention policy may introduce a separately named user-visible history boundary; it must not be conflated with Base persistence.
Memory and SQLite stores share the same resolved-head and immutable-history contract suite.
## 11. API
```plain text
GET  /workspace?slot=default&knownRevision=42
POST /workspace/changes
POST /workspace/history/undo
POST /workspace/history/redo
POST /workspace/history/confirm
GET  /workspace/history?limit=50&cursor=...
```
The access gate supplies User and Project. Request JSON cannot choose either.
```json
{
  "submissionId": "01K1...",
  "expectedRevision": 42,
  "sessionId": "session_7",
  "undoGroupId": "",
  "operations": [
    {
      "op": "set_panel_view",
      "tabId": "tab_resource_17",
      "side": "inspector",
      "patch": {
        "collapsed": false,
        "activeLensId": "details",
        "target": {
          "resource": {"kind": "slides", "id": "deck_5"},
          "kind": "object",
          "path": [
            {"kind": "slide", "id": "slide_9"},
            {"kind": "object", "id": "object_2"}
          ]
        }
      }
    }
  ]
}
```
`GET` returns a resolved projection:
- current Resource names and kinds;
- bounded stored lens IDs; Alpha resolves each against the mounted adapter and renders its default when the stored ID is unavailable;
- revision and update time;
- no private inverse operations or submission hashes.
`GET /workspace/history` returns summaries, never raw operations or private inverses. A plain ChangeSet may expose a bounded summary of its accepted public operation types. A compensation is identified by `UndoOf` or `RedoOf` lineage and exposes an empty type list by construction; filtering its private operation list into a partial public list is forbidden.
If `knownRevision` equals the current revision, Omega returns `304` or a compact unchanged result. Alpha fetches on project entry, reconnect, foreground resume, mutation conflict, and a bounded active-project polling interval. A future push channel may carry only `(WorkspaceID, Revision)` invalidations; clients still fetch authoritative state.
## 12. Backend-initiated navigation
Agent and system flows use the same service:
```go
type NavigationRequest struct {
    RecipientUserID string
    ProjectID       string
    Resource        ResourceRef
    Target          *TargetRef
    Reason          string
    SubmissionID    string
}
```
Rules:
- a backend actor may mutate only the named recipient's Workspace after a user-initiated workflow or an explicit product rule;
- Resource membership and access are re-resolved;
- open, activate, and reveal form one `UndoGroupID`;
- the ChangeSet records `ActorKind = "agent"` or `"system"` and remains undoable;
- delivery is a revision invalidation, not an imperative UI message;
- background work never opens a tab for every project member.
## 13. Alpha adapter contract
Each surface registers serializable state independently from its component implementation:
```typescript
export interface WorkspaceSurfaceAdapter<TView, TTarget> {
  resourceKind: string;
  defaultContextLens(): string;
  defaultInspectorLens(): string;
  validateContextLens(id: string): boolean;
  validateInspectorLens(id: string): boolean;
  decodeViewState(state: ViewStateEnvelope): TView;
  encodeViewState(state: TView): ViewStateEnvelope;
  decodeTarget(target: TargetRef): TTarget | null;
  reveal(target: TTarget): Promise<VisibilityProof>;
  resourceAtTarget(target: TTarget): ResourceRef;
}
```
Components, icons, supported-lens registries, and default-lens choice remain runtime registrations in Alpha. Omega neither mirrors those registries in configuration nor carries a `LensPolicy` solely to accept every bounded ID. Only stable lens IDs, schema versions, targets, and bounded payloads cross the API. `validateContextLens` and `validateInspectorLens` decide whether the stored preference is currently renderable; otherwise the adapter uses its local default without treating the persisted Workspace as corrupt.
## 14. Failure behavior
Stable errors include:
```plain text
workspace_not_found
workspace_revision_conflict
submission_conflict
invalid_operation
invalid_tab
tab_not_closeable
duplicate_resource_tab
resource_not_found
resource_forbidden
resource_unavailable
invalid_lens
invalid_target
target_unavailable
view_state_too_large
undo_unavailable
undo_conflict
redo_unavailable
reveal_required
continuation_expired
```
Recovery:
- invalid cached state is discarded and fetched;
- malformed or oversized lens IDs are rejected as `invalid_lens`; a bounded but unregistered ID is preserved by Omega while Alpha renders its adapter default;
- stale targets degrade to resource-level selection;
- invalid active tabs fall back to Overview;
- an authoritatively denied or deleted Resource tab is removed by a persisted system reconciliation without exposing stale metadata; transient lookup failures return an error and preserve the Base;
- conflicts preserve local intent in a pending queue and replay only operations marked safe;
- a failed view-state sync never blocks resource editing.
## 15. Security and privacy
- Every store predicate includes Workspace ID plus user and project scope.
- Project membership is required, but read-only project members may manage their own Workspace because it is personal UI state.
- Every Resource and Target reference is validated against the current project and access context.
- The Workspace endpoint rejects resource bodies, selected text, prompt content, free-form search content, credentials, and arbitrary unversioned JSON.
- Per-envelope and aggregate bounds prevent state-amplification attacks.
- Logs include operation kind, request ID, user, project, Workspace ID, revision, Tab ID, and Resource ID; they omit opaque payload bodies.
- Private Workspace navigation does not enter project Activity.
- Omega's transport-level `sessionActivity` middleware already bumps Session `LastActivityAt` after every successful project-scoped mutating request, including `POST /workspace/changes`; Workspace needs no Session-liveness adapter.
- That automatic bump does not update active Resource focus, `CurrentDocumentID`, caret, or selection. Those remain explicit Session/presence updates through their separate, authorized contract when collaborators should see them.
- `SessionID` remains on Workspace ChangeSets for origin tracking, undo grouping, multi-session conflict analysis, and diagnostics.
- Sign-out clears local caches, pending operations, active adapters, continuation tokens, and transient drafts.
## 16. Migration from the current runtime
Current Alpha:
- stores `tabs`, `activeTabId`, one global `context`, and one global `inspector`;
- writes localStorage immediately and sends a debounced whole-state `PUT`;
- derives active surface sections at runtime;
- disposes resource runtimes when their tabs close.
Current Omega:
- accepts an arbitrary JSON object up to 64 KiB;
- stores one opaque row by user × project;
- replaces it wholesale without revision CAS or operation history.
The typed schema deliberately uses `workspace_aggregates`; the existing opaque `workspaces` table remains parked and read-only through the rollback window. Reusing `workspaces` would cause the run-every-startup `CREATE TABLE IF NOT EXISTS` migration to retain the legacy column shape. During the rollback window, implementation contracts for the blob path are named `LegacyWorkspace` and `LegacyStore`; the typed aggregate owns the canonical `Workspace` and `Store` names.
Direct pre-release cutover:
1. Create `workspace_aggregates`, `workspace_change_sets`, and `user_project_action_heads` without altering the legacy `workspaces` table.
2. On the first typed read for a user × project × slot, migrate transactionally and idempotently:
	- return the typed aggregate immediately when it already exists;
	- otherwise read and decode the legacy row;
	- preserve valid stable Tab IDs and order;
	- turn Overview and Agents into system tabs;
	- attach the former global panel widths to `Chrome`;
	- seed each tab's lens/collapse state from the former global panels;
	- validate and deduplicate Resource references;
	- insert the typed aggregate under its unique scope key;
	- if a concurrent migration wins, reload that winner.
3. Use a clean default only when the legacy row is absent or structurally malformed. Database failures, temporary Resource-metadata failures, and access-resolution failures return an error and must not overwrite recoverable state with a default.
4. Deploy the compatible Alpha and Omega builds together. Alpha upgrades its local cache, uses typed commands, and never calls the legacy PUT. Omega removes or rejects that PUT; there is no dual-write mode or runtime cutover flag.
5. Keep the legacy table untouched through the rollback window, then drop it in the final cleanup migration.
6. Ensure runtime reacquisition is idempotent so undoing a close can remount or reuse the correct Resource runtime.
Malformed legacy state must never block project entry, but infrastructure failures must remain visible rather than becoming silent data loss.
## 17. Acceptance criteria
1. Sign out, restart Omega, sign back in, and reopen the project: the same tabs, order, active tab, panel widths, lenses, targets, and resource viewport return.
2. Switching tabs restores each tab's own context lens, inspector lens, collapse state, target, and viewport without leaking state from another tab.
3. Opening an already open Resource focuses the existing Tab ID.
4. Resolving a launcher preserves its Tab ID.
5. Permanent destinations cannot close or move outside their pinned region.
6. Two commands with the same Submission ID and body return one accepted ChangeSet; a different body conflicts.
7. Two writers at one expected revision produce one winner.
8. Close-active Undo restores the exact tab, order, view state, and focus before any content is undone.
9. Edit A → select B → Undo returns to A; the next Undo reveals and compensates the A edit.
10. Content Undo never targets an inactive Resource.
11. Content Undo cannot apply until its stable target is visible and the continuation still matches both heads.
12. Bulk close and grouped backend navigation undo atomically.
13. Panel/viewport sync never appears as an Undo step.
14. Reordering tabs is undoable.
15. Access revocation fails closed and leaks no cached title or target label.
16. Workspace and Resource packages remain independent; integration occurs through ports in wiring.
17. Memory and SQLite stores pass identical reducer, CAS, idempotency, undo, redo, and fold tests.
18. Alpha browser tests cover refresh, project switch, two sessions, offline boot cache, conflict recovery, runtime disposal/reacquisition, and keyboard undo focus.
19. Unknown but bounded lens IDs survive Omega round-trips while Alpha renders the mounted adapter's default; adding an Alpha lens requires no Omega deployment.
20. Resource authorization is exercised in service tests, while reducer tests require no Resource metadata fake and remain deterministic.
21. Authoritative deletion or denial removes a tab through one sync-only revision and repairs focus; simulated metadata timeout or database failure leaves the Base unchanged.
22. Close-active selection, before-anchor moves, launcher collision, mixed-class batches, and deterministic system IDs match the rules in this contract.
## 18. Explicit non-goals
- Shared team workspaces or shared tab layouts.
- Named workspace layouts in V1.
- Persisting caret offsets, selected text, prompt drafts, or free-form search queries.
- Treating workspace navigation as project activity.
- Storing resource content or titles in the Workspace aggregate.
- Cross-resource atomic content transactions.
- Undoing collaborator changes.
- Supporting unregistered Resource kinds or arbitrary client-defined operations.
## Sources and superseded evidence
- [Taurus Omega runtime model](https://github.com/gccurtis/taurus-omega/blob/main/docs/architecture/runtime-model.md)
- [Current Omega Workspace capability](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/workspace/workspace.go)
- [Current Omega Workspace HTTP handler](https://github.com/gccurtis/taurus-omega/blob/main/core/handlers/workspace/workspace.go)
- [Current Omega Workspace SQLite store](https://github.com/gccurtis/taurus-omega/blob/main/core/platform/storage/sqlite/sqlite_workspace.go)
- [Current Omega Document ChangeSet model](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/document/changeset.go)
- [Current Omega Document undo/redo service](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/document/service_history.go)
- [Current Alpha Workspace state](https://github.com/gccurtis/taurus-alpha/blob/main/src/lib/data/workspace.ts)
- [Current Alpha App shell](https://github.com/gccurtis/taurus-alpha/blob/main/src/lib/features/shell/AppShell.svelte)
- [Current Alpha surface/lens contribution contract](https://github.com/gccurtis/taurus-alpha/blob/main/src/lib/features/shared/surface.ts)
- [Current Alpha Resource runtime registry](https://github.com/gccurtis/taurus-alpha/blob/main/src/lib/systems/resources/registry.ts)
- <mention-page url="https://app.notion.com/p/39ab6410e502815181b3d2823db55262"/>
- <mention-page url="https://app.notion.com/p/39ab6410e502818ca583db1400b14d60"/>
- <mention-page url="https://app.notion.com/p/39bb6410e50281e1b16deb0d20197971"/>
- <mention-page url="https://app.notion.com/p/3abb6410e5028179a844c0af77b21ffe"/>
- <mention-page url="https://app.notion.com/p/3abb6410e50281df8762c162e9a6eb13"/>
- <mention-page url="https://app.notion.com/p/3abb6410e50281258d89d5719fa851fc"/>

