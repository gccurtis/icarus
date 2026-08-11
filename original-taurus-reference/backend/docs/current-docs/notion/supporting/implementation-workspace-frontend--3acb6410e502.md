---
title: "Implementation — Workspace Frontend"
notion_page_id: "3acb6410e50281d2813fe9f261c35ac4"
notion_url: "https://app.notion.com/3acb6410e50281d2813fe9f261c35ac4"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 15:32:49Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Implementation — Workspace Frontend

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Outcome:** Rebuild Taurus Alpha's Workspace state layer as a typed, optimistic projection of <mention-page url="https://app.notion.com/p/3acb6410e50281ddaa6dca8f6e1802fb"/>. Tabs, active focus, per-tab Context lens, Inspector open/target state, and resource view state must survive project re-entry while Omega remains authoritative. Undo must route through the unified Workspace history API and visibly reveal a target before Resource content changes.
>
> **Frontend refinement:** <mention-page url="https://app.notion.com/p/3adb6410e502818fb987d5f5004117e3"/> preserves a user-chosen Context lens registry but defines Inspector as one adaptive selection-driven surface. Persist Context `lensId`; persist Inspector open/collapse and stable target/state envelopes. Do not build a fixed Inspector facet registry. Temporary Quarterback takeover remains ephemeral and restores the selection Inspector.
## 1. Scope
This plan changes Taurus Alpha's Workspace state, shell composition, Resource runtime lifecycle, persistence client, and undo routing.
Deliver:
- typed Workspace DTOs and versioned codecs;
- server-first project entry with a last-acknowledged local boot cache;
- an optimistic serial command queue over `ExpectedRevision` and `SubmissionID`;
- per-tab context lens, inspector lens, collapse state, target, and Resource viewport;
- workspace-wide panel width;
- Resource-kind surface adapters with stable lens IDs and target reveal;
- safe two-session conflict reconciliation;
- backend navigation pickup;
- unified undo/redo, focus restoration, and reveal confirmation;
- migration from the current localStorage shape;
- state, integration, accessibility, and browser tests.
Do not redesign:
- the document editor's visual or interaction design;
- the contents or icons of editor lenses;
- the Taurus visual system;
- the underlying Resource data models.
The frontend work changes how existing and future surfaces register, persist, restore, and reveal state. It does not prescribe new editor chrome.
## 2. Current-state findings
### `src/lib/data/workspace.ts`
The current store owns:
```typescript
type Workspace = {
  projectId: string;
  tabs: Tab[];
  activeTabId: string;
  context: PanelState;
  inspector: PanelState;
};
```
It:
- writes `taurus.ws.<projectId>` to localStorage;
- sends a debounced whole-state `PUT /workspace`;
- keeps context and inspector state once per project rather than once per tab;
- implements open, resolve, activate, close, close-others, close-right, and move locally;
- has no revision, Submission ID, pending-command queue, conflict phase, or history receipt.
### `AppShell.svelte`
The shell:
- derives one active Tab;
- reads one `$workspace.context` and `$workspace.inspector`;
- repairs active sections against the currently mounted surface;
- passes global panel state to both rails.
This means tab switching can preserve only one project-global active section/collapse state. It cannot restore “Details on object A in Slides” and “Comments in Document B” independently.
### Surface contributions
`src/lib/features/shared/surface.ts` already has the correct seed:
- stable serializable section IDs;
- runtime-only Svelte component registrations;
- a Resource stage contributing context and inspector sections to a blind shell.
Keep that boundary. Extend it into a registry/adapter contract rather than persisting components.
### Resource runtimes
`src/lib/systems/resources/registry.ts` keeps runtimes keyed by project and Resource and disposes one when its Tab closes. Undoing a close must therefore reacquire or recreate the runtime safely before revealing the restored target.
## 3. Target module shape
```plain text
src/lib/systems/workspace/
  types.ts               DTO and domain-facing client types
  codec.ts               versioned runtime validation/decoding
  api.ts                 GET, submit, undo, redo, confirm
  reducer.ts             optimistic mirror of Omega operations
  controller.svelte.ts   confirmed + optimistic state and lifecycle
  command-queue.ts       serial submission, retry, conflict recovery
  history.ts             keyboard routing and response application
  visibility.ts          target coverage and reveal confirmation
  cache.ts               last-acknowledged boot cache
  migration.ts           old localStorage -> typed cache hint
  replay-policy.ts       explicit safe/unsafe replay rules
  test-builders.ts
  index.ts

src/lib/systems/surfaces/
  registry.ts            Resource/system adapter registration
  types.ts               lens/view/target contracts
  view-state.ts          envelope helpers and bounds

src/lib/features/shell/
  AppShell.svelte
  WorkSurface.svelte
  SidePanel.svelte
  TabStrip.svelte
  WorkspaceGate.svelte   optional boot/degraded boundary

src/lib/data/workspace.ts
  compatibility facade only, then remove when imports are migrated
```
Follow Alpha's established convention: `$data/workspace` may remain the temporary public facade, while implementation lives in `$systems/workspace/*`.
## 4. Client types
Mirror the server contract without recreating Resource content:
```typescript
export type ResourceRef = {
  kind: string;
  id: string;
};

export type TargetSegment = {
  kind: string;
  id: string;
};

export type TargetRef = {
  resource: ResourceRef;
  kind: string;
  path: TargetSegment[];
};

export type ViewStateEnvelope = {
  kind: string;
  schemaVersion: number;
  data: unknown;
};

export type LensState = {
  lensId: string;
  state: ViewStateEnvelope;
};

export type PanelViewState = {
  collapsed: boolean;
  activeLensId: string;
  target?: TargetRef;
  lenses: LensState[];
};

export type TabViewState = {
  context: PanelViewState;
  inspector: PanelViewState;
  resource: ViewStateEnvelope;
};

export type WorkspaceTab =
  | {
      id: string;
      kind: 'system';
      system: { viewId: string };
      view: TabViewState;
      openedAt: string;
    }
  | {
      id: string;
      kind: 'launcher';
      launcher: ViewStateEnvelope;
      view: TabViewState;
      openedAt: string;
    }
  | {
      id: string;
      kind: 'resource';
      resource: ResourceRef;
      title: string; // response projection, never submitted as authority
      view: TabViewState;
      openedAt: string;
    };

export type WorkspaceProjection = {
  id: string;
  projectId: string;
  slotKey: 'default' | string;
  schemaVersion: number;
  tabs: WorkspaceTab[];
  activeTabId: string;
  chrome: {
    contextWidthPx: number;
    inspectorWidthPx: number;
  };
  revision: number;
  updatedAt: string;
};
```
Decode all server and cache data through a runtime validator. A TypeScript assertion is not validation.
```typescript
export function decodeWorkspace(input: unknown): WorkspaceProjection {
  const parsed = workspaceSchema.safeParse(input);
  if (!parsed.success) throw new WorkspaceDecodeError(parsed.error);
  return parsed.data;
}
```
Use one project-wide runtime-validation mechanism for all new boundary codecs. At the reviewed Alpha commit no schema validator is present in `package.json`; select one free/open-source mechanism or implement narrow local decoding, then avoid competing schema systems.
## 5. Client controller
The controller owns acknowledged state, optimistic projection, and command lifecycle:
```typescript
export type WorkspacePhase =
  | 'idle'
  | 'booting'
  | 'ready'
  | 'saving'
  | 'reconciling'
  | 'offline'
  | 'degraded';

export type PendingWorkspaceCommand = {
  submission: WorkspaceSubmission;
  replay: ReplayPolicy;
  createdAt: number;
  attempts: number;
};

export type WorkspaceClientState = {
  phase: WorkspacePhase;
  projectId: string | null;
  confirmed: WorkspaceProjection | null;
  optimistic: WorkspaceProjection | null;
  pending: PendingWorkspaceCommand[];
  inFlight: string | null;
  error: WorkspaceClientError | null;
};
```
Rules:
- `confirmed` is the latest valid Omega projection.
- `optimistic` is `confirmed` plus pending commands applied by the mirror reducer.
- only one Workspace command is in flight because every command depends on the previous acknowledged revision;
- Resource content sync remains independent and may continue concurrently;
- a view-state failure never discards Resource edits;
- changing project cancels requests, drops pending Workspace intent, clears transient adapters, and starts a new controller generation.
Svelte-facing API:
```typescript
export interface WorkspaceController {
  readonly state: Readable<WorkspaceClientState>;
  enterProject(projectId: string): Promise<void>;
  leaveProject(): Promise<void>;
  submit(
    operations: WorkspaceOperation[],
    options?: SubmitOptions
  ): Promise<WorkspaceReceipt>;
  undo(input: UndoInput): Promise<UndoResult>;
  redo(input: UndoInput): Promise<UndoResult>;
  refresh(reason: RefreshReason): Promise<void>;
  flushViewState(): Promise<void>;
}
```
## 6. Project entry and restoration
Sequence:
```plain text
Project route selected
  → increment controller generation
  → cancel old fetches, timers, continuations, and pending view sync
  → release old project runtime/session
  → read matching last-acknowledged cache
  → render cache as provisional shell when valid
  → GET authoritative Workspace
  → replace/reconcile by Workspace ID + revision
  → cache confirmed projection
  → acquire active Resource runtime
  → restore active tab lenses and viewport
  → join Session/presence for the active Resource
```
Every successful `POST /workspace/changes` already passes through Omega's transport-level Session activity middleware, so Workspace submissions automatically refresh `LastActivityAt`. Alpha must not add a second liveness call or Workspace-specific Session observer.
That automatic activity bump does not publish active-Resource focus, `CurrentDocumentID`, caret, or collaborative selection. If those signals should be visible to collaborators, the active Resource runtime continues to send the existing explicit Session/presence update when focus or selection changes. `SessionID` remains on Workspace submissions for origin tracking, undo grouping, multi-session conflict handling, and diagnostics.
The cache key must include user and project:
```typescript
function cacheKey(userId: string, projectId: string) {
  return `taurus.workspace.v1.${userId}.${projectId}.default`;
}
```
Persist only the last acknowledged projection:
```typescript
type CachedWorkspace = {
  cacheSchemaVersion: 1;
  workspaceId: string;
  userId: string;
  projectId: string;
  revision: number;
  savedAt: string;
  projection: WorkspaceProjection;
};
```
Do not cache:
- pending commands as if accepted;
- continuation tokens;
- Resource contents;
- prompt drafts;
- selected text;
- free-form search input;
- presence;
- credentials or access decisions.
If cached and server Workspace IDs differ, discard the cache. If the cache is newer than the server due to a failed prior write, the server still wins; pending intent was not accepted.
## 7. Optimistic command queue
### 7.1 Submission
```typescript
async function enqueue(
  operations: WorkspaceOperation[],
  replay: ReplayPolicy
): Promise<WorkspaceReceipt> {
  const base = state.optimistic;
  if (!base) throw new WorkspaceNotReadyError();

  const submission: WorkspaceSubmission = {
    submissionId: uuidv7(),
    expectedRevision: predictedRevision(base),
    sessionId: currentSessionId(),
    operations
  };

  const next = applyWorkspaceOperations(base, operations);
  appendPending({ submission, replay, createdAt: Date.now(), attempts: 0 });
  setOptimistic(next);
  return pump();
}
```
Before sending, set `ExpectedRevision` to the confirmed revision plus already acknowledged serial commands. Never allow two commands to share an expected revision.
### 7.2 Structural vs view commands
Send immediately:
- open Resource or launcher;
- resolve launcher;
- activate;
- close, close others, close right;
- reorder;
- undo/redo shell results.
Coalesce and debounce:
- panel width;
- collapsed state when produced by transient resize/animation;
- active lens;
- stable target;
- per-lens disclosure/filter memory;
- Resource viewport.
Recommended view-state sync:
- coalesce by `(TabID, side, lensID)` or `(TabID, resource-view)`;
- debounce 250–500 ms after the latest stable update;
- flush on tab switch, project exit, browser visibility loss, and before undo;
- never send pointer-move or scroll events one-for-one;
- use stable anchors rather than raw pixel positions when possible.
### 7.3 Replay policies
```typescript
export type ReplayPolicy =
  | { kind: 'ensure-resource-open'; resource: ResourceRef }
  | { kind: 'activate-if-present'; tabId: string }
  | { kind: 'replace-view-if-tab-present'; tabId: string }
  | { kind: 'never-automatic' };
```
On `409 workspace_revision_conflict`:
1. freeze the queue;
2. fetch authoritative Workspace;
3. replace `confirmed`;
4. inspect each pending command in order;
5. replay only if its policy still holds;
6. mint a new Submission ID and expected revision for a new semantic submission;
7. surface skipped destructive/reorder intent honestly;
8. recompute `optimistic`.
Never replay a close or reorder purely because its old Tab IDs still exist. User intent may no longer match the newly observed layout.
## 8. Per-tab panels and lenses
### 8.1 Shell state split
`AppShell.svelte` should derive:
```typescript
const activeTab = $derived(
  $workspace.optimistic?.tabs.find(
    (tab) => tab.id === $workspace.optimistic?.activeTabId
  ) ?? null
);

const context = $derived(activeTab?.view.context ?? null);
const inspector = $derived(activeTab?.view.inspector ?? null);
const chrome = $derived($workspace.optimistic?.chrome ?? null);
```
Then:
- `SidePanel.width` comes from `chrome`;
- `SidePanel.collapsed` and `activeSection` come from the active Tab's panel;
- selecting a lens sends `set_panel_view` for the active Tab;
- resizing sends `set_chrome`;
- switching Tab changes panel contents without copying state between tabs.
### 8.2 Surface registry
Extend the current contribution model:
```typescript
export type LensDefinition = {
  id: string;
  label: string;
  icon: Component;
  content?: Component;
  placeholder?: string;
  defaultState: () => ViewStateEnvelope;
};

export interface WorkspaceSurfaceAdapter<TView = unknown, TTarget = unknown> {
  key: string; // "system:overview" or "resource:document"
  contextLenses(): readonly LensDefinition[];
  inspectorLenses(): readonly LensDefinition[];
  decodeViewState(envelope: ViewStateEnvelope): TView;
  encodeViewState(state: TView): ViewStateEnvelope;
  decodeTarget(target: TargetRef): TTarget | null;
  currentVisibleTarget(): TargetRef | null;
  reveal(target: TTarget): Promise<VisibilityProof>;
}
```
Registry:
```typescript
surfaceRegistry.registerSystem('overview', overviewAdapter);
surfaceRegistry.registerSystem('agents', agentsAdapter);
surfaceRegistry.registerResource('document', documentAdapter);
// spreadsheet, slides, and chat register when their stages land.
surfaceRegistry.seal();
```
Stable IDs are persisted. Labels, icons, and Svelte components are not.
### 8.3 Lens repair
The server normalizes known policy where it can, but Alpha must remain resilient to a newer or removed lens:
```typescript
function resolvedLens(
  requested: string,
  available: readonly LensDefinition[]
): LensDefinition {
  return (
    available.find((lens) => lens.id === requested) ??
    available[0] ??
    unavailableLens
  );
}
```
Repair should not loop:
- render fallback immediately;
- submit one coalesced normalization only when the Tab remains active;
- ignore a server projection that already contains the fallback;
- include codec schema version in lens payload.
### 8.4 What may persist
Good durable examples:
```typescript
type DocumentWorkspaceView = {
  anchor?: {
    rowId?: string;
    blockId?: string;
    atomId?: string;
    offsetWithinAtom?: number;
  };
  zoom: number;
  horizontalScroll: number;
};

type SpreadsheetWorkspaceView = {
  activeSheetId: string;
  topRowId?: string;
  leftColumnId?: string;
  activeRange?: { sheetId: string; address: string };
  zoom: number;
};

type SlidesWorkspaceView = {
  activeSlideId: string;
  selectedObjectIds: string[];
  viewport: { zoom: number; centerXEmu: number; centerYEmu: number };
};

type ChatWorkspaceView = {
  anchorTurnId?: string;
  followLatest: boolean;
};
```
Do not persist selected text, an entire ProseMirror selection JSON, draft prompt text, arbitrary formula-edit text, or raw Resource bodies in Workspace.
## 9. Tab and Resource runtime lifecycle
### 9.1 Stable Tab identity
Key the mounted stage by Tab ID:
```javascript
{#key activeTab.id}
  <WorkSurface tab={activeTab} />
{/key}
```
Resolving a launcher keeps the same Tab ID, so any shell-level focus, animation, and pending state can transition without becoming a different tab.
### 9.2 Runtime acquisition
```typescript
async function mountResourceTab(tab: ResourceTab) {
  const runtime = resourceRegistry.acquire(
    currentProjectId,
    tab.resource
  );
  await runtime.load();
  runtime.attachView(tab.id);
  await runtime.restoreWorkspaceView(tab.view.resource);
  return runtime;
}
```
Inactive open Resources may keep their view-independent runtimes alive according to the current registry policy. Only the active stage view must be mounted.
### 9.3 Close and undo-reopen
On accepted close:
1. detach the Tab view;
2. wait until no open Tab references the Resource;
3. flush/cancel Resource-local pending work according to that runtime's contract;
4. release/dispose it.
On undo restoring a tab:
1. apply the authoritative Workspace projection;
2. focus the restored Tab;
3. reacquire or recreate the runtime idempotently;
4. load the current Resource head;
5. restore the tab view envelope;
6. reveal the stable target when requested.
Never assume an undo-restored runtime is the same JavaScript object that existed before close.
### 9.4 Project switch
Dispose all old-project:
- Resource runtimes;
- surface contributions;
- subscriptions and pollers;
- pending Workspace commands;
- undo continuations;
- view sync timers;
- presence/session handles;
- transient drafts.
Use a controller generation token so a slow old request cannot populate the new project.
## 10. Unified undo and redo
### 10.1 Keyboard ownership
The shell routes Undo only when it is semantically appropriate:
- native text inputs, textareas, and contenteditable controls outside a Taurus Resource editor retain native local undo;
- a Resource editor that commits canonical mutations delegates to the unified coordinator;
- transient inspector form drafts may use local undo until Apply/commit;
- `Mod-Z` and `Mod-Shift-Z` must not both hit a local editor history and Omega.
```typescript
function shouldUseNativeUndo(target: EventTarget | null): boolean {
  return isNativeDraftControl(target) && !isCanonicalResourceEditor(target);
}
```
### 10.2 Flush before planning
A canonical editor may hold optimistic operations not yet acknowledged. Before unified undo:
```typescript
async function prepareForUnifiedHistory(): Promise<void> {
  await workspaceController.flushViewState();
  const runtime = activeResourceRuntime();
  if (runtime) await runtime.flushCanonicalChanges();
  await waitForAllRequiredAcks();
}
```
If canonical changes conflict or fail, abort Undo and surface that failure. Do not ask Omega to undo an older head while the user sees unacknowledged newer content.
### 10.3 Request
```typescript
async function performHistory(direction: 'undo' | 'redo') {
  await prepareForUnifiedHistory();
  const adapter = activeSurfaceAdapter();
  const visibleTarget = adapter?.currentVisibleTarget() ?? null;

  const result = await workspaceApi.history({
    direction,
    workspaceRevision: currentConfirmedRevision(),
    visibleTarget
  });

  return applyHistoryResult(result);
}
```
### 10.4 Discriminated response handling
```typescript
type HistoryResult =
  | { kind: 'empty' }
  | { kind: 'workspace_applied'; workspace: WorkspaceProjection }
  | {
      kind: 'reveal_required';
      workspace: WorkspaceProjection;
      target: TargetRef;
      continuationToken: string;
    }
  | {
      kind: 'resource_applied';
      workspace: WorkspaceProjection;
      resource: ResourceHistoryReceipt;
      target: TargetRef;
    };
```
`workspace_applied`:
1. acknowledge the new projection;
2. mount/focus its active Tab;
3. restore its panel and view state;
4. do not call any Resource undo locally.
`reveal_required`:
1. apply any returned authoritative Workspace projection;
2. verify the target Resource is the active Tab;
3. acquire the adapter/runtime;
4. decode the stable target;
5. call `adapter.reveal`;
6. wait for mount, layout, scroll, focus, and a visibility proof;
7. call `/workspace/history/confirm` with the token and proof target;
8. apply the resulting Resource receipt.
`resource_applied`:
1. advance/reload the Resource runtime from the receipt;
2. reveal and focus the returned target;
3. retain the active Workspace Tab and its lenses.
### 10.5 Visibility proof
```typescript
export type VisibilityProof = {
  target: TargetRef;
  mounted: true;
  intersecting: boolean;
  focused: boolean;
};
```
The browser proof is a UX signal, not authorization. Omega still validates the continuation and both revisions.
`reveal` should:
- select the correct sheet/slide/turn/block by stable ID;
- expand collapsed ancestors if required;
- scroll the target into the safe central viewport;
- focus the canonical surface;
- wait at least one render/layout turn;
- return failure rather than silently revealing an ordinal neighbor.
### 10.6 Required browser scenarios
- edit A → activate B → Undo focuses A without content mutation;
- second Undo reveals A's target and then changes content;
- edit A → close A → Undo recreates the Tab and runtime;
- close-right → Undo restores all tabs/order/view state;
- reorder → Undo restores prior order;
- panel/viewport updates do not consume Undo;
- target stale -\> honest unavailable state, no wrong object selected;
- continuation conflict -\> refetch/replan, no duplicate undo;
- `Mod-Z` inside an uncommitted inspector text field stays local.
## 11. Backend-initiated navigation and multi-session sync
V1 observes server changes through revision checks:
- project entry;
- browser foreground/resume;
- reconnect;
- after agent/task completion;
- bounded poll while a project is active;
- immediately after any conflict.
```typescript
async function refreshIfChanged() {
  const knownRevision = state.confirmed?.revision ?? -1;
  const response = await workspaceApi.get({ knownRevision });
  if (response.kind === 'unchanged') return;
  reconcileAuthoritative(response.workspace, 'remote');
}
```
When an agent opens/activates/reveals a Resource:
- treat the server projection as authoritative;
- preserve any independent acknowledged Resource content;
- safely rebase or drop pending Workspace view sync;
- mount the newly active Tab;
- announce the navigation through focus and accessibility status;
- keep the agent's grouped shell change undoable.
Two devices share the one default Workspace. Last accepted **operation order** wins through revision CAS; there is no whole-state last-write-wins. A conflict may temporarily move focus as the user on another device navigates. This is the intended V1 shared-layout behavior for one user's sessions. Workspace navigation automatically maintains Session liveness, while richer collaborator focus remains an explicit presence update.
## 12. Migration from the current Alpha store
### 12.1 Read old cache once
```typescript
function migrateLegacyCache(
  userId: string,
  projectId: string
): CachedWorkspaceHint | null
```
The legacy cache is a hint for first paint only. Omega performs authoritative legacy-row migration.
Conversion:
- preserve Tab IDs/order when valid;
- map `overview` and `agents` to system tabs;
- copy widths into `chrome`;
- seed every Tab's context/inspector from the old global state;
- create empty versioned Resource view envelopes;
- omit legacy titles from submissions;
- mark the hint provisional.
After one successful typed GET:
- write V1 cache;
- remove `taurus.ws.<projectId>`;
- never call the old `putWorkspaceState`;
- record migration telemetry without payload contents.
### 12.2 API facade transition
Temporarily preserve familiar imports:
```typescript
// src/lib/data/workspace.ts
export {
  workspace,
  enterProject,
  openResource,
  activateTab,
  closeTab,
  closeOthers,
  closeRight,
  moveTabs,
  setPanelView,
  setChrome
} from '$systems/workspace';
```
Delete local mutation implementations as callers migrate. Do not leave two Workspace stores active.
## 13. Error and offline behavior
### Offline
- render the last acknowledged cache with a clear offline/saving status;
- permit Resource behavior only according to each Resource runtime's offline contract;
- queue bounded Workspace intent in memory;
- do not claim persistence until Omega acknowledges;
- on reconnect, fetch before replay;
- discard a reveal continuation because it is short-lived.
### Invalid server or cache state
- cache decode failure: discard cache and continue to server;
- server decode failure: enter degraded shell with project exit/retry, log schema/version only;
- unknown lens: render adapter default and submit one repair;
- missing active Tab: use server-normalized Overview;
- unavailable Resource: unmount safely and show generic state without stale title.
### Conflict
Show user-facing friction only for skipped structural intent. Routine view-state conflict may refetch and coalesce silently when the Tab still exists.
## 14. Accessibility and focus
- System and Resource tabs keep correct `role="tab"`, `aria-selected`, roving tab index, and stable DOM identity.
- A restored or backend-activated Tab receives a concise live-region announcement.
- Undo restoring a closed Tab moves keyboard focus to the Resource surface after mount, not merely to the tab button, unless target reveal fails.
- Context and inspector active lenses expose selected state.
- Collapsed rail state remains Tab-specific and is restored without trapping focus in hidden content.
- When a focused lens disappears during surface repair, focus moves to the resolved active lens button.
- Reduced-motion settings apply to scroll/reveal transitions; correctness never depends on animation.
## 15. Performance
- Keep the shell projection small and bounded.
- Use one derived active Tab rather than subscribing every component to every tab's full view payload.
- Coalesce high-frequency view state.
- Do not remount Resource runtime merely because a lens changes.
- Cache only acknowledged projections.
- Parse/validate once at the API boundary.
- Use stable IDs as Svelte keys.
- Do not mount every open Resource stage; keep view-independent runtimes according to registry policy.
- Poll revisions with backoff and pause in hidden tabs except where an active continuation or task completion requires it.
## 16. Test plan
### Unit
- codecs reject invalid discriminants and payload bounds;
- optimistic reducer matches Omega fixtures operation-for-operation;
- cache schema/user/project isolation;
- replay-policy decisions;
- view command coalescing;
- active Tab and lens derivation;
- target coverage and adapter decoding;
- stale project generation cannot write new state.
### Controller
- cache then server bootstrap;
- no cache bootstrap;
- matching/newer/older revision reconciliation;
- serial expected revisions;
- idempotent retry;
- conflict refetch and safe replay;
- unsafe close/reorder skipped;
- project switch cancels old work;
- offline/reconnect;
- backend navigation projection.
### Shell/component
- widths global, collapse/lens per Tab;
- switching Tabs restores independent lenses and targets;
- launcher resolution preserves keyed Tab;
- permanent tab constraints;
- unavailable lens repair;
- unavailable Resource removes sensitive title.
### Runtime integration
- open acquires once;
- inactive Tab retains expected runtime;
- close releases;
- undo-reopen reacquires;
- project switch disposes all;
- Resource receipt advances current runtime;
- viewport restoration uses stable IDs.
### History
- keyboard routing/native input behavior;
- flush-before-undo;
- workspace compensation response;
- reveal-required mount/reveal/confirm;
- continuation conflict;
- target unavailable;
- no local + server double undo;
- redo symmetry.
### E2E
1. Open three Resources, choose different lenses and targets, resize rails, reload, and verify exact restoration.
2. Sign out, restart backend, sign in, enter the project, and verify restoration.
3. Use two browser contexts; create a revision conflict and verify deterministic reconciliation.
4. Edit Document A, activate B, Undo, then Undo again.
5. Edit A, close A, Undo, verify runtime reacquisition, then Undo content.
6. Bulk-close and restore.
7. Reorder and restore.
8. Agent completion opens/reveals a result and one Undo reverses the grouped shell navigation.
9. Revoke Resource access while open and verify no cached title/target leak.
10. Switch projects during slow Workspace and Resource requests and prove no cross-project state appears.
Run the repository's existing format, typecheck, unit, component, and Playwright commands. Add deterministic fake-clock/fake-ID fixtures rather than time-dependent waits.
## 17. Delivery slices
### Slice A — typed read and restoration
- types/codecs/API;
- controller + confirmed cache;
- server-authoritative entry;
- global widths and per-tab panels;
- no legacy PUT.
### Slice B — optimistic commands
- mirror reducer;
- serial queue;
- structural actions;
- view coalescing;
- conflict replay policy.
### Slice C — runtime and surface adapters
- registry contract;
- per-tab lens/view state;
- runtime close/reacquire;
- target reveal for Document.
### Slice D — unified history
- keyboard router;
- flush gating;
- plan/reveal/confirm;
- focus and accessibility;
- browser scenarios.
### Slice E — hardening and removal
- two-session polling;
- backend navigation;
- offline/degraded states;
- telemetry;
- delete compatibility facade and old cache path.
Coordinate Slice A with the Omega typed endpoint deployment as one direct pre-release cutover. Do not add a runtime mode or dual writes, and do not enable the new Alpha against an Omega that still interprets the endpoint as an opaque whole-state object. The compatible Alpha never calls the legacy PUT.
## 18. Definition of done
- Omega, not localStorage, is the durable authority.
- Alpha stores and sends only the typed Workspace contract.
- Every Tab restores its own lenses, collapse state, target, and Resource view.
- Panel widths remain workspace-wide.
- Structural commands are optimistic, serial, revisioned, and idempotent.
- Conflict handling replays only explicit safe intent.
- A Resource runtime can be disposed on close and correctly reacquired by Undo.
- Unified Undo never queries or mutates invisible Resource content from Alpha.
- Content mutation waits for mount/reveal/visibility confirmation.
- Native draft undo and canonical Resource undo do not double-fire.
- Project switch and sign-out clear every old-project transient.
- Backend navigation is observed and remains undoable.
- Workspace mutations refresh Session liveness without a duplicate adapter; explicit presence updates remain responsible for active Resource, caret, and selection.
- Unit, controller, component, runtime, accessibility, and E2E suites pass.
- Current Workspace facade, whole-state PUT, and old cache key are removed after cutover.
## Sources
- <mention-page url="https://app.notion.com/p/3acb6410e50281ddaa6dca8f6e1802fb"/>
- [Current Alpha Workspace state](https://github.com/gccurtis/taurus-alpha/blob/main/src/lib/data/workspace.ts)
- [Current Alpha App shell](https://github.com/gccurtis/taurus-alpha/blob/main/src/lib/features/shell/AppShell.svelte)
- [Current Alpha shell lens policy](https://github.com/gccurtis/taurus-alpha/blob/main/src/lib/features/shell/shell-sections.ts)
- [Current Alpha surface contribution contract](https://github.com/gccurtis/taurus-alpha/blob/main/src/lib/features/shared/surface.ts)
- [Current Alpha Resource runtime registry](https://github.com/gccurtis/taurus-alpha/blob/main/src/lib/systems/resources/registry.ts)
- [Current Alpha Document editor architecture](https://github.com/gccurtis/taurus-alpha/blob/main/docs/architecture/document-editor.md)
- <mention-page url="https://app.notion.com/p/39ab6410e502815181b3d2823db55262"/>
- <mention-page url="https://app.notion.com/p/39ab6410e502815993f9c185aaa5ff4b"/>

