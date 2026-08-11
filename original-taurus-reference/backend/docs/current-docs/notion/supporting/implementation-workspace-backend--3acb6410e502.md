---
title: "Implementation — Workspace Backend"
notion_page_id: "3acb6410e5028138917ff768d9776e8e"
notion_url: "https://app.notion.com/3acb6410e5028138917ff768d9776e8e"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 15:32:49Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Implementation — Workspace Backend

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Outcome:** Replace Omega's opaque per-user/project workspace blob with the typed, revisioned Workspace aggregate in <mention-page url="https://app.notion.com/p/3acb6410e50281ddaa6dca8f6e1802fb"/>. Ship persistence, typed operations, conflict handling, exact shell undo/redo, visible-target content undo coordination, migration, and tests without importing Resource-family internals into Workspace.
## 1. Scope
This plan changes Taurus Omega only. It deliberately does not preserve the current `GET` + whole-object `PUT` contract as the target architecture.
Deliver:
- typed Workspace domain model and pure reducer;
- one default Workspace per user × project with stable `WorkspaceID`;
- resolved-head Base persistence, immutable ChangeSets, revision CAS, idempotency, private inverses, undo groups, and undo/redo lineage;
- structured tabs, panel/lens state, targets, and view envelopes;
- generic Resource metadata and content-history ports;
- deterministic action ordering across Workspace and Resource history;
- reveal-before-mutate undo continuations;
- typed HTTP endpoints and user-project serial dispatch;
- legacy-row migration and removal path;
- memory/SQLite parity, security limits, telemetry, and full tests.
Do not deliver:
- Alpha UI changes;
- Spreadsheet, Slides, or Chat content-history providers before those capabilities exist;
- shared team workspaces;
- named layout slots;
- a new realtime transport;
- project Activity entries for private navigation.
## 2. Current-state findings
The present implementation is intentionally small:
- `core/capability/workspace/workspace.go` validates only that the payload is a JSON object under 64 KiB.
- `core/handlers/workspace/workspace.go` exposes `GET /workspace` and a whole-state `PUT /workspace`.
- `core/platform/storage/sqlite/sqlite_workspace.go` upserts a single `state` string by user × project.
- Alpha sends the whole Workspace after a 700 ms debounce.
This has no typed invariants, stable command intent, revision conflict, idempotency, private inverse, undo history, cross-session reconciliation, or safe backend navigation.
Relevant existing Omega patterns to reuse:
- Document's Base + ChangeSets + revision CAS pattern, without importing its persistence checkpoint semantics.
- Document submission hashing and scoped idempotency.
- SQLite revision compare-and-swap.
- private inverse operations and compensating ChangeSets.
- transport's per-key serial dispatch.
- access gate construction of User and Project scope.
- composition-root adapters rather than capability-to-capability imports.
Do **not** copy Document's current “target must be exact aggregate head” rule blindly. Workspace has sync-only view revisions between undoable actions, so its shell-history eligibility must ignore later sync-only ChangeSets while still requiring the latest uncompensated undoable shell action.
## 3. Target package shape
```plain text
core/capability/workspace/
  model.go              Workspace, Base, Tab, panel/view/target types
  operation.go          closed operation vocabulary + JSON decoding
  reducer.go            pure apply, normalize, validate, inverse generation
  changeset.go          ChangeSet, history class, footprints, hashing
  service.go            get, create-default, submit
  service_history.go    candidate, undo, redo, groups
  history_coordinator.go Workspace vs active-Resource arbitration
  continuation.go       signed short-lived reveal tokens
  content_history.go    ContentHistoryPort and coordination DTOs
  ports.go              Store, ResourceMetadata, ActionClock, ID, Clock
  projection.go         title/lens/access-safe response projection
  errors.go
  memory.go
  *_test.go

core/handlers/workspace/
  workspace.go          GET and typed ChangeSet admission
  history.go            undo, redo, confirm, private history
  dto.go
  errors.go
  *_test.go

core/platform/storage/sqlite/
  sqlite_workspace.go
  sqlite_workspace_history.go
  sqlite_action_clock.go
  migrations.go

core/wiring/
  workspace.go          construction and generic Resource metadata adapter
  workspace_history.go  Resource-kind registry and Document adapter
```
The coordinator remains under `workspace` because Omega's capability-isolation rule forbids a separate capability from importing Workspace. Workspace depends only on a generic `ContentHistoryPort`; it never imports `document` or another Resource capability. Wiring owns the Resource-kind registry and adapters, imports both sides, and implements the port. This is coordination, not a second content ledger.
## 4. Phase 0 — freeze contracts and characterize legacy behavior
### 4.1 Add characterization tests
Before replacing the handler:
- prove current missing-state response behavior;
- prove current membership/access gate scoping;
- prove a read-only project member can save private Workspace state;
- capture the existing Alpha JSON shape used by legacy migration;
- verify permanent Overview/Agents, resource tab, and panel fields that need conversion.
### 4.2 Add fixtures
```go
type LegacyStateV0 struct {
    Tabs []struct {
        ID           string `json:"id"`
        Title        string `json:"title"`
        Closeable    bool   `json:"closeable"`
        Kind         string `json:"kind"`
        ResourceID   string `json:"resourceId"`
        ResourceKind string `json:"resourceKind"`
    } `json:"tabs"`
    ActiveTabID string `json:"activeTabId"`
    Context     struct {
        Width     int    `json:"width"`
        Collapsed bool   `json:"collapsed"`
        Section   string `json:"section"`
    } `json:"context"`
    Inspector struct {
        Width     int    `json:"width"`
        Collapsed bool   `json:"collapsed"`
        Section   string `json:"section"`
    } `json:"inspector"`
}
```
Never migrate `Title` as authority. It is usable only as a local diagnostic while a Resource reference is validated.
### 4.3 Freeze direct-cutover policy
Taurus is a solo pre-release deployment, so do not add `WorkspaceMode`, dual writes, or a runtime cutover flag. Deploy compatible Alpha and Omega builds together:
- typed reads and commands become the only live contract;
- the legacy `PUT /workspace` is removed or rejected;
- the old `workspaces` table remains parked and read-only through the rollback window;
- rollback means redeploying the old Alpha/Omega pair, not switching modes inside one process.
## 5. Phase 1 — domain model and pure reducer
### 5.1 Implement typed model
Translate the governing model exactly:
```go
type Scope struct {
    UserID    string
    ProjectID string
    SlotKey   string
}

type Workspace struct {
    ID        string
    Scope     Scope
    Base      Base
    Revision  int64
    UpdatedAt time.Time
}
```
Use explicit deep-copy methods for every slice and opaque byte payload. A store read must not alias mutable memory held by the store.
### 5.2 Closed operation decoding
Do not expose one “operation with every possible field” indefinitely. Use an envelope plus typed payload:
```go
type Operation struct {
    Type OperationType `json:"op"`
    Data any           `json:"-"`
}

func (o *Operation) UnmarshalJSON(raw []byte) error {
    var header struct {
        Type OperationType `json:"op"`
    }
    if err := json.Unmarshal(raw, &header); err != nil {
        return ErrInvalidOperation
    }
    switch header.Type {
    case OpOpenResource:
        o.Data = new(OpenResourceOp)
    case OpOpenLauncher:
        o.Data = new(OpenLauncherOp)
    case OpResolveLauncher:
        o.Data = new(ResolveLauncherOp)
    case OpActivateTab:
        o.Data = new(ActivateTabOp)
    case OpCloseTab:
        o.Data = new(CloseTabOp)
    case OpCloseOthers:
        o.Data = new(CloseOthersOp)
    case OpCloseRight:
        o.Data = new(CloseRightOp)
    case OpMoveTabs:
        o.Data = new(MoveTabsOp)
    case OpSetChrome:
        o.Data = new(SetChromeOp)
    case OpSetPanelView:
        o.Data = new(SetPanelViewOp)
    case OpSetResourceView:
        o.Data = new(SetResourceViewOp)
    case OpRevealTarget:
        o.Data = new(RevealTargetOp)
    default:
        return ErrUnsupportedOperation
    }
    return decodePayload(raw, o.Data)
}
```
Private inverse-only payloads must be constructible only inside the package and rejected by public decoding.
### 5.3 Normalize, validate, and apply
Implement:
```go
func DefaultBase(ids IDSource, now time.Time) Base
func Normalize(base *Base, lenses LensPolicy)
func ValidateBase(base Base, bounds Bounds) error
func Apply(before Base, ops []Operation, deps ApplyDeps) ApplyResult
```
`ApplyResult`:
```go
type ApplyResult struct {
    Base      Base
    Inverse   []Operation
    Footprint Footprint
    Class     HistoryClass
}
```
Specific reducer tests:
- open unseen Resource;
- open existing Resource focuses without duplicate;
- open/resolve launcher preserves Tab ID;
- close inactive tab;
- close active tab applies deterministic neighbor;
- close others/right restores exact order and state through inverse;
- activate system/resource/launcher;
- reorder contiguous and discontiguous IDs relative to stable anchor;
- reject crossing pinned system region;
- update global width without changing tab lens state;
- update one tab's context/inspector without touching another;
- reject cross-resource inspector target;
- normalize unknown lens;
- degrade stale target;
- reject payload and aggregate bounds.
### 5.4 Title and access projection
Define a capability-neutral port:
```go
type ResourceMetadataPort interface {
    Resolve(
        ctx context.Context,
        projectID string,
        userID string,
        ref ResourceRef,
    ) (ResourceMetadata, error)
}

type ResourceMetadata struct {
    Ref       ResourceRef
    Name      string
    Lifecycle string
}
```
The port implementation belongs in wiring and calls the generic Resource catalog. Workspace never calls Document or another family.
On an authoritative `resource_forbidden` or `resource_not_found` result, projection omits the title and the service performs the Model's private, revisioned, sync-only `remove_inaccessible_tab` reconciliation. It is not an ordinary `Normalize` side effect. A timeout, database failure, or temporary metadata-provider failure leaves the Workspace unchanged; tests must prove no stale title leaks.
## 6. Phase 2 — ChangeSets, Store, and SQLite
### 6.1 Store contract
```go
type Store interface {
    // Workspace returns the complete resolved Base at the aggregate's revision.
    // It never reconstructs state by replaying ChangeSets.
    Workspace(ctx context.Context, scope Scope) (Workspace, error)
    ChangeSetByID(
        ctx context.Context,
        workspaceID, changeSetID string,
    ) (ChangeSet, error)
    ChangeSetBySubmission(
        ctx context.Context,
        workspaceID, submissionID string,
    ) (ChangeSet, error)
    Append(
        ctx context.Context,
        scope Scope,
        expectedRevision int64,
        nextBase Base,
        change ChangeSet,
    ) error
    History(
        ctx context.Context,
        workspaceID string,
        cursor HistoryCursor,
        limit int,
    ) (HistoryPage, error)
    // The store only filters and pages private undoable rows. The service owns
    // direction-specific lineage interpretation, so this call carries no direction.
    HistoryCandidates(
        ctx context.Context,
        workspaceID, authorID string,
        cursor HistoryCursor,
        limit int,
    ) (HistoryPage, error)
}
```
`Append` atomically:
1. verifies `(user_id, project_id, slot_key)`;
2. checks `revision == expectedRevision`;
3. inserts the immutable ChangeSet;
4. replaces `base_json` with the complete resolved `nextBase`;
5. updates logical revision and timestamp;
6. commits.
`nextBase` is always state at the resulting revision. ChangeSets are never replayed through `Apply` to serve a read, rebuild the Base, or allocate Tab IDs.
### 6.2 Migration DDL
Create the tables and indexes from the governing model. Persist both fields of every `ActionStamp`: nullable `action_seq` and `action_accepted_at`. The candidate index follows the Store query's Workspace-local `seq DESC` order; `action_seq` remains the cross-capability comparison value. Do not destructively alter the legacy table in the same migration.
The Store verifies the Workspace/ChangeSet relationship on append. SQLite foreign-key enforcement is not enabled on the shared connection in V1, so the DDL foreign key is not the sole runtime defense. Do not enable it locally for Workspace alone: that is a separate global storage-policy change requiring an all-table audit.
Recommended sequence:
```plain text
M1: create workspace_aggregates, workspace_change_sets, user_project_action_heads
M2: migrate valid legacy rows transactionally on first typed read
M3: deploy compatible typed Alpha/Omega together and disable/remove legacy PUT
M4: retain the legacy table read-only through the rollback window
M5: after rollback window, drop legacy workspaces table/state column
```
`workspace_aggregates` is the canonical typed table name. The run-every-startup schema already owns a legacy table named `workspaces`; using `CREATE TABLE IF NOT EXISTS workspaces` for the typed shape would silently retain the old columns and fail later typed queries. Never reuse the legacy name or opaque `state` column.
### 6.3 SQLite CAS
```sql
UPDATE workspace_aggregates
SET revision = ?, updated_at = ?
WHERE id = ? AND user_id = ? AND project_id = ? AND revision = ?;
```
Require `RowsAffected() == 1` before committing. The in-memory store must produce the same conflict.
### 6.4 Resolved head persistence and immutable history
There is no Base fold in Workspace V1. `workspace_aggregates.base_json` is the resolved head at `workspace_aggregates.revision`; every `Append` writes both together.
The immutable `workspace_change_sets` rows serve audit, idempotency, exact private compensation, undo/redo lineage, and history projection. They are not an event-sourced state-reconstruction log. In particular, public `open_resource` intent does not contain the generated Tab ID, so replaying it would violate stable identity.
Undo and redo apply stored private compensation operations against the current resolved head, then append a new ChangeSet. A stored private restore operation carries the concrete Tab snapshot and preserves its ID; it must not invoke ID allocation.
V1 has no age- or count-based undo watermark. `HistoryCandidates` must derive eligibility from author, `HistoryClass`, action order, compensation lineage, grouping, and inverse preconditions—not from `seq > base_seq` or an equivalent storage cutoff. Retain all ChangeSets in V1. Any future retention boundary is a separately named, user-visible history policy that requires its own product decision and migration.
## 7. Phase 3 — service admission and idempotency
### 7.1 Submission validation and hash
Hash the exact normalized public submission before server-only IDs or inverses are attached:
```go
func ValidateAndHash(sub Submission) (Submission, string, error)
```
Scope `SubmissionID` to Workspace. Same ID + same hash returns the accepted result. Same ID + different hash returns `submission_conflict`.
### 7.2 Strict revision policy
V1 admits only `ExpectedRevision == head.Revision`.
Do not implement implicit semantic rebase in Omega's first increment. Safe retry intent belongs in Alpha:
- `open_resource` may refetch and reissue because it is identity-idempotent;
- `activate_tab` may reissue only if the requested Tab still exists;
- close, reorder, resolve, and target updates are not automatically replayed without revalidation.
This keeps server acceptance legible. A later server-side disjoint-footprint proof can be added without changing the ChangeSet shape.
### 7.3 Immutable navigation grouping
Store every accepted ChangeSet. `UndoGroupID` means “compensate these accepted rows as one semantic step”; it never authorizes row replacement.
Group validation:
- same Workspace, author, session, and direction;
- consecutive undoable shell actions without an intervening undoable shell action from another actor;
- bounded group size;
- every member uncompensated;
- compensation applies inverses in reverse Action/ChangeSet order atomically.
Independent Tab activation commands have empty group IDs in V1.
## 8. Phase 4 — deterministic cross-capability action order
### 8.1 Action clock
Workspace and Document each define the same narrow local port using primitive return values:
```go
type ActionClock interface {
    NextAction(
        ctx context.Context,
        userID, projectID string,
    ) (seq int64, acceptedAt time.Time, err error)
}
```
The concrete SQLite clock satisfies both interfaces. Neither capability imports the other or a new cross-capability `history` package merely to share `ActionStamp`.
SQLite allocation:
```sql
INSERT INTO user_project_action_heads(user_id, project_id, next_seq)
VALUES (?, ?, 2)
ON CONFLICT(user_id, project_id) DO UPDATE
SET next_seq = next_seq + 1
RETURNING next_seq - 1;
```
The returned sequence is monotonic and unique per user × project. Gaps caused by an admitted request later failing are allowed; ordering, not density, is the contract.
### 8.2 Add action order to Document
Extend Document ChangeSet persistence and public/private projection:
```go
type ChangeSet struct {
    // existing fields...
    AuthorActionSeq int64 `json:"authorActionSeq,omitempty"`
}
```
Allocate an action sequence only for undoable user-authored content submissions. System jobs and collaborator changes may omit the author's action sequence unless they are explicitly part of that user's undo chain.
Migration:
- old Document rows use `CreatedAt` + ChangeSet ID only in a bounded legacy fallback;
- new rows always receive `AuthorActionSeq`;
- remove the fallback after all undo-relevant retained rows have stamps or after a deliberate history boundary.
### 8.3 Preserve capability independence
Document depends on its own narrow primitive-returning `ActionClock` port supplied at construction. Wiring/SQLite supplies the same concrete clock used by Workspace. Document stores `AuthorActionSeq int64`; the wiring adapter translates that field into Workspace's coordination `ActionStamp`. Document does not import Workspace or a History capability.
## 9. Phase 5 — shell undo/redo provider
### 9.1 Candidate selection
Workspace's provider returns the latest eligible user-authored shell action:
```go
func (s *Service) Candidate(
    ctx context.Context,
    scope Scope,
    authorID string,
    direction HistoryDirection,
) (HistoryCandidate, bool, error)
```
Rules:
- `HistoryCandidates` structurally filters `HistorySyncOnly` rows and pages newest-first until the lineage walk reaches a decision; a bounded prefix is never treated as a history boundary;
- the service, not the Store, interprets undo/redo direction from immutable lineage. Walking newest-first keeps separate tallies for redos applied to an undo and undos still applied to an action; booleans are insufficient because an action may be undo → redo → undo repeatedly;
- the result is the author's newest currently-applied undoable ChangeSet, grouped by `UndoGroupID` when present;
- sync-only revisions after the target do not make it ineligible, while a later currently-applied undoable shell action does;
- inverse preconditions must still hold against the current resolved Base. If the newest candidate fails them, report no candidate; never fall back to an older action;
- undo and redo append new compensation ChangeSets at the current head.
### 9.2 Compensation
```go
func (s *Service) Undo(
    ctx context.Context,
    scope Scope,
    actor Actor,
    target CandidateRef,
) (Workspace, ChangeSet, error)
```
Compensation:
- receives a fresh `SubmissionID`;
- uses current Workspace revision as `ExpectedRevision`;
- applies stored private inverses;
- records `UndoOf` or `RedoOf`; `UndoOf` names the compensated action, while `RedoOf` names the undo being compensated;
- is always `HistoryUndoable`, receives a fresh `ActionStamp`, and uses a reserved `cmp_` compensation Submission ID. Public ChangeSet admission rejects that prefix, so only service-authored compensation can occupy it. Cross-capability redo ordering depends on this action-order position;
- returns the resolved Workspace projection.
Define and test a complete linear redo policy. A new undoable non-compensation action after an undo clears the redo candidate logically; do not delete the prior rows.
## 10. Phase 6 — content-history coordinator
### 10.1 Workspace port and wiring registry
```go
// Declared by core/capability/workspace.
type ContentHistoryPort interface {
    Candidate(
        ctx context.Context,
        scope UserProjectScope,
        resource ResourceRef,
        authorID string,
        direction HistoryDirection,
    ) (HistoryCandidate, bool, error)
    Apply(
        ctx context.Context,
        scope UserProjectScope,
        candidate HistoryCandidate,
    ) (Receipt, error)
}

// Implemented in core/wiring/workspace_history.go.
type Registry interface {
    Register(resourceKind string, provider Provider) error
    Seal() error
    Provider(resourceKind string) (Provider, bool)
}
```
The registry and family adapters live in wiring, not in another capability. Register Document there. An unknown or future Resource kind returns no content candidate; shell history still works.
### 10.2 Document adapter
The adapter translates current Document history:
```go
type DocumentHistoryAdapter struct {
    documents *document.Documents
}
```
It must:
- find the current eligible authored head using Document's existing constraints;
- derive a stable reveal target from the ChangeSet footprint/inverse;
- expose the author's `ActionStamp`;
- call existing `Undo`/`Redo` with the exact ChangeSet ID;
- map Document conflicts to coordinator errors.
If the current Document ChangeSet does not retain a sufficient reveal footprint, add one. Do not infer the target from UI state or ordinal positions.
### 10.3 Arbitration
The coordinator:
1. loads Workspace;
2. asks Workspace for its shell candidate;
3. asks only the active resource's provider for a content candidate;
4. chooses the larger `ActionStamp.Seq`;
5. applies Workspace compensation immediately, or creates a content reveal plan;
6. returns a discriminated result.
Never query every open resource for its latest edit. That would reintroduce invisible-content undo.
## 11. Phase 7 — reveal-before-mutate continuation
### 11.1 Plan endpoint
```go
type UndoRequest struct {
    Direction         HistoryDirection `json:"direction"`
    VisibleTarget     *TargetRef        `json:"visibleTarget,omitempty"`
    WorkspaceRevision int64             `json:"workspaceRevision"`
}

type UndoResponse struct {
    Kind         string          `json:"kind"`
    Workspace    *WorkspaceView  `json:"workspace,omitempty"`
    Resource     *ResourceReceipt `json:"resource,omitempty"`
    Reveal       *TargetRef      `json:"reveal,omitempty"`
    Continuation string          `json:"continuationToken,omitempty"`
}
```
If the content target is not covered by `VisibleTarget`, issue a continuation and do not call the Resource provider.
### 11.2 Token
Use a server-signed, short-lived token or a random opaque token backed by a bounded in-memory/SQLite row. It binds:
```go
type ContinuationClaims struct {
    UserID               string
    ProjectID            string
    WorkspaceID          string
    ActiveTabID          string
    Direction            HistoryDirection
    ProviderKind         string
    Resource             ResourceRef
    CandidateChangeSetID string
    CandidateActionSeq   int64
    WorkspaceRevision    int64
    ResourceRevision     int64
    Reveal               TargetRef
    ExpiresAt            time.Time
}
```
Prefer a signed token if all claims fit comfortably and revocation before expiry is unnecessary. Keep expiry short, for example 30 seconds.
### 11.3 Confirm endpoint
Confirmation:
- reconstructs access scope from the gate;
- verifies signature, expiry, user, project, active Tab, Workspace revision, Resource head, and candidate;
- verifies submitted visible target covers the planned reveal;
- delegates to the provider;
- returns resource receipt plus current Workspace.
Any mismatch returns `undo_conflict`; the client replans. Confirmation is idempotent through a token ID or `SubmissionID`.
## 12. Phase 8 — HTTP and dispatch
### 12.1 Routes
Replace:
```plain text
PUT /workspace
```
with:
```plain text
GET  /workspace
POST /workspace/changes
POST /workspace/history/undo
POST /workspace/history/redo
POST /workspace/history/confirm
GET  /workspace/history
```
Keep `GET /workspace` but change it to the typed projection. During cutover, an explicit API version or response schema version prevents an old Alpha build from interpreting it as the opaque shape.
### 12.2 Handler boundary
Handlers:
- bind DTOs;
- get User/Project from `access.Context`;
- pass Actor and Scope;
- map stable errors to HTTP;
- never normalize tabs, resolve resources, arbitrate history, or generate inverses.
Suggested statuses:
```plain text
200 accepted/read/undo result
304 known revision unchanged
400 invalid operation/target/lens
403 resource or project access denied
404 missing resource/tab/workspace where not default-created
409 revision, submission, undo, redo, or continuation conflict
410 expired continuation
413 view/aggregate payload too large
422 structurally valid but unsupported operation
```
### 12.3 Serial key
Workspace mutations and history planning/application use:
```go
func workspaceSerialKey(ctx access.Context, _ endpoint.Request) string {
    return "workspace:" + ctx.User.ID + ":" + ctx.Project.ID
}
```
Register it in `operationMode` / `operationSerialKey`. SQLite CAS remains the correctness boundary.
Content submissions keep their Resource serial key. The action clock provides cross-capability total order; do not serialize every user's edits across every Resource solely for Workspace.
## 13. Phase 9 — wiring
Composition root tasks:
1. Construct Workspace Store.
2. Construct user-project Action Clock.
3. Construct generic Resource metadata adapter.
4. Construct Workspace service with ports.
5. Add Action Clock to Document construction.
6. Construct and seal history-provider registry.
7. Register the Document adapter.
8. Construct continuation signer/store.
9. Construct Undo coordinator.
10. Pass services to handlers/routes.
Example:
```go
actionClock := sqlite.NewUserProjectActionClock(store)
documentSvc := document.New(store, document.Options{
    // existing options...
    ActionClock: actionClock,
})

providers := newWorkspaceHistoryRegistry()
must(providers.Register("document", documentHistoryAdapter{documentSvc}))
providers.Seal()

workspaceSvc := workspace.New(store, workspace.Options{
    Resources:      resourceMetadataAdapter{resources},
    ContentHistory: providers,
    Continuations:  continuations,
    ActionClock:    actionClock,
    IDs:            ids,
    Clock:          clock,
})
```
Architecture tests must reject:
```plain text
core/capability/workspace -> core/capability/document
core/capability/workspace -> spreadsheet/slides/chat internals
core/capability/document -> core/capability/workspace
```
## 14. Phase 10 — legacy migration and cutover
### 14.1 Conversion
```go
func MigrateLegacy(
    legacy LegacyStateV0,
    scope Scope,
    deps MigrationDeps,
) (Workspace, error)
```
Rules:
- allocate stable Workspace ID;
- preserve valid Tab IDs;
- generate missing IDs;
- create canonical Overview and Agents system tabs;
- validate every Resource against project/access;
- deduplicate by Resource reference;
- copy current panel widths into `Chrome`;
- seed each tab with the old active section and collapse values;
- create versioned empty Resource view envelopes;
- use Overview when the former active Tab is missing;
- discard legacy titles as authority;
- write one migration ChangeSet with `HistorySyncOnly` or begin at Revision 0 with the migrated Base.
Do not make migration itself an undoable user action.
First-read migration is transactional and idempotent:
1. Read `workspace_aggregates` by user × project × slot and return it when present.
2. Otherwise read and decode the legacy `workspaces` row.
3. Normalize and validate the typed Base.
4. Insert under the typed table's unique scope key.
5. If another request inserted first, reload the winner.
Create a clean default only when the legacy row is absent or structurally malformed. A database error, temporary Resource-metadata failure, or access-resolution failure aborts the read and preserves the legacy row; it must not be converted into an apparently successful empty Workspace.
### 14.2 Alpha compatibility window
The new Omega read must advertise:
```json
{
  "schemaVersion": 1,
  "workspace": { "...": "..." }
}
```
An old Alpha must fail conspicuously rather than issue a legacy PUT over typed state. Use route versioning, content type, or deployment coordination to guarantee this.
### 14.3 Rollback
Keep the old table untouched through one rollback window. Do not dual-write typed state back into the opaque row. Rollback may temporarily restore the old Alpha/Omega pair and lose typed-only shell changes; document that operationally.
### 14.4 Session activity
Do not add a Workspace → Session observer or liveness adapter. Omega's transport-level `sessionActivity` middleware already bumps `LastActivityAt` after every successful project-scoped POST/PUT/PATCH/DELETE, which includes `POST /workspace/changes`.
This automatic bump is only liveness. Explicit Session updates remain necessary if Alpha wants collaborator presence to expose the active Resource, `CurrentDocumentID`, caret, or selection. Keep `SessionID` on Workspace ChangeSets for origin tracking, undo groups, conflict analysis, and diagnostics.
## 15. Phase 11 — security, observability, and limits
### 15.1 Security tests
- forged Resource from another project;
- stale access after membership revocation;
- read-only member manages private Workspace but cannot edit Resource content;
- target Resource mismatch;
- title leak after access denial;
- overlong ID and target path;
- unregistered lens or Resource kind;
- oversized envelope and aggregate;
- invalid private inverse in public JSON;
- continuation replay, tamper, expiry, and cross-user reuse.
### 15.2 Logging and metrics
Structured logs:
```plain text
workspace_id
user_id
project_id
request_id
submission_id
operation_types
prior_revision
new_revision
history_class
undo_group_id
action_seq
conflict_kind
latency_ms
```
Never log lens payload bodies, selected text, targets' user-visible labels, prompt drafts, or resource contents.
Metrics:
- typed Workspace reads and mutations;
- revision and submission conflicts;
- migration success/fallback;
- state payload size;
- retained ChangeSet count, history-page latency, and candidate-query latency;
- undo results by shell/content/reveal/empty/conflict;
- continuation expiry/conflict;
- unavailable Resource normalization.
## 16. Test matrix
### Unit
- every reducer operation and inverse;
- normalization and bounds;
- ChangeSet hash/idempotency;
- history-class calculation;
- immutable undo grouping;
- candidate selection with sync-only revisions;
- action-stamp ordering;
- reveal-target coverage.
### Store contract
Run unchanged against memory and SQLite:
- create/default get;
- scoped lookup;
- revision CAS;
- duplicate Submission ID/hash;
- ordered immutable ChangeSet retention;
- private inverse persistence;
- resolved-head persistence on every append;
- read/restart paths that never replay ChangeSets or consume an ID source;
- candidate selection beyond a former fold threshold;
- concurrent writers;
- action-clock uniqueness.
### Service
- open existing Resource idempotently;
- safe projection and title resolution;
- legacy migration through the real Workspace service and real SQLite store, including valid first-read conversion and unreadable-legacy failure preservation; the typed HTTP/dev-test suite independently covers the handler boundary and no longer writes legacy rows through the removed PUT route;
- exact shell undo/redo;
- close/restore active tab;
- bulk-close atomic compensation;
- new undoable action invalidates redo candidate;
- backend grouped open/activate/reveal.
### Coordinator
- only active Resource provider queried;
- shell newer than content;
- content newer than shell;
- deterministic ActionStamp selection;
- inactive Resource content never selected;
- reveal required before apply;
- changed Workspace head invalidates continuation;
- changed Resource head invalidates continuation;
- unknown Resource provider still permits shell undo.
### Handler
- access gate scope cannot be overridden by JSON;
- status/error mappings;
- body limits;
- `knownRevision`;
- serial dispatch key;
- legacy PUT unavailable after cutover.
### Race and restart
- `go test -race ./...`;
- two sessions mutating one Workspace;
- process restart between reveal plan and confirmation;
- process restart after ChangeSet append;
- history query racing a submit;
- access revocation while a continuation is outstanding.
## 17. Delivery slices
### Slice A — typed persistence
- model/reducer;
- memory/SQLite stores;
- typed GET and changes endpoint;
- migration;
- Alpha can persist/reload tabs and views.
### Slice B — exact shell history
- private inverses;
- Action Clock;
- Workspace candidate/undo/redo;
- close/select/reorder scenarios.
### Slice C — Document coordination
- Document ActionStamp;
- Document provider adapter;
- coordinator;
- reveal continuation and confirm.
### Slice D — backend navigation and hardening
- grouped agent/system navigation;
- polling invalidation contract;
- telemetry, bounds, architecture tests;
- legacy removal.
Do not merge Slice C until Slice A and B store contracts are stable. Do not remove the legacy route until a compatible Alpha is deployed.
## 18. Definition of done
- The runtime and API conform to the Workspace model page.
- The old opaque PUT is no longer used.
- Workspace revision CAS and idempotency are authoritative.
- No accepted ChangeSet is rewritten.
- Exact tab/lens/view state survives restart and sign-in.
- Workspace and Document histories are ordered by `ActionStamp`.
- Undo never queries inactive Resources.
- Content undo cannot execute before the target is visibly confirmed.
- Close/select/reorder scenarios work through one coordinator.
- Resource-family dependencies exist only in wiring adapters.
- Memory and SQLite store contracts pass with resolved-head reads and immutable retained history.
- Security, migration, conflict, restart, and race tests pass.
- Runtime architecture docs and endpoint references describe the typed Workspace contract.
## Sources
- <mention-page url="https://app.notion.com/p/3acb6410e50281ddaa6dca8f6e1802fb"/>
- [Taurus Omega runtime model](https://github.com/gccurtis/taurus-omega/blob/main/docs/architecture/runtime-model.md)
- [Current Workspace model/service](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/workspace/workspace.go)
- [Current Workspace HTTP handler](https://github.com/gccurtis/taurus-omega/blob/main/core/handlers/workspace/workspace.go)
- [Current Workspace SQLite store](https://github.com/gccurtis/taurus-omega/blob/main/core/platform/storage/sqlite/sqlite_workspace.go)
- [Current dispatch model](https://github.com/gccurtis/taurus-omega/blob/main/core/transport/dispatch.go)
- [Current Document ChangeSet model](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/document/changeset.go)
- [Current Document undo/redo](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/document/service_history.go)
- <mention-page url="https://app.notion.com/p/39ab6410e502818ca583db1400b14d60"/>
- <mention-page url="https://app.notion.com/p/39bb6410e50281e1b16deb0d20197971"/>

