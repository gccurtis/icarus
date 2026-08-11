---
title: "Model — Document Context"
notion_page_id: "3adb6410e502810dae4ae1b4866d8c6d"
notion_url: "https://app.notion.com/3adb6410e502810dae4ae1b4866d8c6d"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-30 06:25:58Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Model — Document Context

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Primary authority.** This page defines the Document Context runtime: the stable lens registry through which a person discovers and works with material available to an open Document. It specializes [System — Context Rail & Lens Runtime](https://app.notion.com/p/3adb6410e5028109af17d131af989809) and is implemented against the Project-scoped Document contracts in [Ω-017 — Close the Document Project vertical slice](https://app.notion.com/p/3adb6410e50281999781e35c8dfacd05).
## Decision
Document Context is a stable, user-chosen set of ten lenses. A selection may update the contents of the active lens, but it never changes the active lens. Context exposes material that is available to the Document; it does not inspect the current selection and it does not own Document mutations.
The V1 lens IDs and order are already present in Taurus Alpha and are canonical:
1. Info
2. Search
3. Outline
4. Layout
5. Templates
6. References
7. Name Manager
8. Comments
9. AI Tasks
10. History
The Document outcome checklist used the product terms **Design** and **Variables**. Those are the responsibilities of the existing `layout` and `name-manager` lenses. They are not additional lenses. A later display-label change may rename a label, but it must not silently change a persisted lens ID.
## Boundary
Document Context owns:
- the exact lens registry, ordering, labels, icon tokens, and availability rules;
- the active lens for each open Document tab;
- lazy activation and disposal of the active lens binding;
- honest loading, empty, stale, unavailable, forbidden, and error states;
- local navigation and the translation of user interaction into typed controller calls.
Document Context does not own:
- canonical Document state, revisioning, authorization, persistence, or sync;
- the current inspection target;
- Project search, Comments, References, Formula names, Tasks, Templates, or History as domain authorities;
- direct HTTP requests, ProseMirror transactions, or capability-specific storage;
- arbitrary component arrays supplied by a route.
Those boundaries produce this dependency direction:
```plain text
DocumentContextRail
  → DocumentContextDefinition
  → DocumentContextBinding
  → DocumentRuntime controllers and capability ports
  → Project-scoped Omega contracts
```
No lens component imports a session singleton, constructs a backend client, or mutates another lens's state.
## Runtime contract
The resource composition root creates one `DocumentContextController` for each open Document runtime. The shell receives definitions; the controller creates bindings.
```typescript
export type DocumentContextLensId =
  | 'info'
  | 'search'
  | 'outline'
  | 'layout'
  | 'templates'
  | 'references'
  | 'name-manager'
  | 'comments'
  | 'ai-tasks'
  | 'history';

export interface DocumentContextDefinition {
  id: DocumentContextLensId;
  label: string;
  icon: IconToken;
  order: number;
  default: boolean;
  availability(
    context: DocumentContextAvailability
  ): ContextAvailability;
}

export interface DocumentContextController {
  readonly activeLens: Readable<DocumentContextLensId>;
  readonly binding: Readable<DocumentContextBinding | null>;

  activate(id: DocumentContextLensId): Promise<void>;
  reveal(target: DocumentContextReveal): Promise<void>;
  execute(command: DocumentContextCommand): Promise<CommandReceipt>;
  deactivate(): void;
  dispose(): void;
}

export interface DocumentContextBinding {
  readonly state: Readable<DocumentContextLensState>;
  readonly actions: DocumentContextActions;
  activate(signal: AbortSignal): Promise<void>;
  deactivate(): void;
  dispose(): void;
}
```
`activate` cancels an earlier in-flight activation. A late response from an inactive lens cannot replace current state. `dispose` releases subscriptions, observers, timers, and abort controllers.
### Working-context projection
A binding reads only the projection it needs. The runtime may share caches, but the UI must not require every lens to load before the rail can render.
```typescript
export interface DocumentContextAvailability {
  projectId: ProjectId;
  documentId: DocumentId;
  revision: Revision;
  permissions: DocumentPermissions;
  capabilities: ProjectCapabilityAvailability;
  sync: SyncStatus;
}

export type DocumentContextLensState<T = unknown> =
  | { status: 'idle' }
  | { status: 'loading'; previous?: T }
  | { status: 'ready'; value: T; revision: Revision }
  | { status: 'empty'; reason: string }
  | { status: 'stale'; value: T; revision: Revision }
  | { status: 'unavailable'; reason: string }
  | { status: 'forbidden'; reason: string }
  | { status: 'error'; error: RecoverableContextError; previous?: T };
```
`stale` is usable data whose refresh failed or whose revision trails the resource projection. It must not be presented as current without a visible status.
## Exact V1 lens registry
<table header-row="true">
<tr>
<td>Order</td>
<td>Stable ID</td>
<td>Label</td>
<td>Icon token</td>
<td>Primary projection and responsibility</td>
</tr>
<tr>
<td>1</td>
<td>`info`</td>
<td>Info</td>
<td>`Info`</td>
<td>Document identity, owner, status, revision, sync, permissions, statistics, and supported resource actions.</td>
</tr>
<tr>
<td>2</td>
<td>`search`</td>
<td>Search</td>
<td>`Search`</td>
<td>In-Document find, filters, result navigation, and typed replacement commands; Project-wide search is a separate query mode.</td>
</tr>
<tr>
<td>3</td>
<td>`outline`</td>
<td>Outline</td>
<td>`ListTree`</td>
<td>Heading and structural outline, current-location following, collapse state, and stable-target navigation.</td>
</tr>
<tr>
<td>4</td>
<td>`layout`</td>
<td>Layout</td>
<td>`LayoutTemplate`</td>
<td>The outcome checklist's Design surface: supported page geometry, document presentation defaults, semantic text styles, and theme tokens.</td>
</tr>
<tr>
<td>5</td>
<td>`templates`</td>
<td>Templates</td>
<td>`SquareStack`</td>
<td>Browse, preview, create from, and apply compatible Document templates through the Template boundary.</td>
</tr>
<tr>
<td>6</td>
<td>`references`</td>
<td>References</td>
<td>`BookOpenText`</td>
<td>Inbound and outbound references, broken targets, usages, reveal, repair, and unlink operations through the Reference boundary.</td>
</tr>
<tr>
<td>7</td>
<td>`name-manager`</td>
<td>Name Manager</td>
<td>`Tags`</td>
<td>The outcome checklist's Variables surface: named values, formulas, descriptions, scopes, usages, validation, and reveal.</td>
</tr>
<tr>
<td>8</td>
<td>`comments`</td>
<td>Comments</td>
<td>`MessageSquareText`</td>
<td>Document comment threads, filters, anchored reveal, reply, resolve, reopen, and deletion according to permission.</td>
</tr>
<tr>
<td>9</td>
<td>`ai-tasks`</td>
<td>AI Tasks</td>
<td>`ListTodo`</td>
<td>Tasks associated with this Document, status/progress, provenance, reveal, cancel, retry, and result application.</td>
</tr>
<tr>
<td>10</td>
<td>`history`</td>
<td>History</td>
<td>`Clock`</td>
<td>Resource revisions and change sets, actor/time summaries, reveal, compare, and Workspace-coordinated undo/redo.</td>
</tr>
</table>
`info` is the only default. The registry is static and deterministic. Capability or permission differences change a lens's availability, never its identity or order. A temporarily unavailable lens remains in its stable location with a reason unless security policy requires concealment.
### Lens-specific contracts
#### Info
- Reads Document metadata, caller-effective permissions, revision, sync state, and bounded statistics.
- Resource lifecycle operations go through the Resource/Document controller.
- It never exposes ACL rows or information the admitted caller cannot view.
#### Search
- Local find and navigation may operate against the current frontend projection.
- Replace-one and replace-all emit typed Document operations with expected revision and idempotency identity.
- Project-wide search calls an admitted, caller-aware Project query and returns only authorized evidence.
- Search results carry stable Document targets, not raw DOM nodes or ProseMirror positions.
#### Outline
- Outline rows identify stable block targets.
- Activating a row moves editor selection/focus through `DocumentRuntime.reveal`.
- Reordering is shown only when a supported typed structural operation exists; drag UI never mutates the editor model directly.
#### Layout
- Owns the available Design context for the whole Document, not properties of the selected block.
- V1 reflects the current continuous-document runtime. It may expose supported paper geometry and semantic defaults, but it does not recreate pagination, page thumbnails, or retired block-manipulation chrome.
- Selected-block layout belongs to Inspector.
#### Templates
- Queries compatible templates without opening another resource.
- Apply/create operations are explicit commands and report conflicts before destructive replacement.
- User-level templates are materialized through the control-plane/template contract; Project copies are independent resources.
#### References
- Uses the Reference capability as authority.
- Every result includes reference identity, direction, target state, and a stable reveal target.
- Repair and unlink are typed operations. The panel never rewrites Document JSON itself.
#### Name Manager
- Uses Formula/name services as authority and does not implement formula evaluation.
- Names are stable entities with scope, expression/value status, dependencies, usages, and validation.
- Reveal navigates to a stable formula or usage target.
#### Comments
- Uses the Comment capability and its anchor contract.
- Selecting a thread reveals its anchor but does not activate Inspector unless the user explicitly asks to inspect it.
- Deleted or detached anchors retain an honest orphaned state and repair actions where supported.
#### AI Tasks
- Uses Agent task summaries and provenance, not ad hoc component-local jobs.
- Applying generated work becomes a typed Document operation and records the resulting change set.
- The panel never grants a task more data access than the admitted caller and Project capability context.
#### History
- Document content history remains resource-owned; Workspace coordinates cross-resource undo/redo.
- A history reveal carries Project ID, tab/resource identity, stable Document target, Context lens, and Inspector target as described by [Ω-027 — Extend Workspace history coordination](https://app.notion.com/p/3acb6410e50281e5a7b8f2ff2506c397).
- Undo/redo reopens and focuses the destination before applying the operation, then restores the stable target with a safe fallback.
## Commands and synchronization
Navigation that changes only viewport or focus stays local. Any persisted change becomes a typed operation.
```typescript
export interface DocumentProjectCommand<T extends DocumentOperation> {
  projectId: ProjectId;
  documentId: DocumentId;
  expectedRevision: Revision;
  submissionId: SubmissionId;
  operation: T;
}
```
Authentication supplies the caller; caller identity or entitlement claims are never trusted from this payload. Omega admits the explicit Project request, checks Document permission, applies revision compare-and-swap and idempotency, persists atomically with its outbox event, and returns the canonical result or a typed conflict.
The frontend controller:
1. validates and normalizes the interaction;
2. issues a typed local navigation or Project command;
3. may project an optimistic state with an explicit pending marker;
4. reconciles the receipt and canonical revision;
5. refreshes only affected bindings;
6. preserves the active lens throughout selection and sync changes.
## Interaction and persistence
- The icon rail uses manual activation: arrow keys move rail focus; `Enter` or `Space` activates.
- Opening or closing Context does not change the selected editor target.
- The active lens is stored per Workspace tab and restored after reopening/sign-in when valid.
- Unknown saved IDs repair to `info` once and emit telemetry; aliases are introduced only by an explicit migration.
- Lens-local filters, scroll positions, and drafts may be ephemeral. They do not become canonical Document state.
- A selection change may update matching results, outline location, comment emphasis, or reference usages. It cannot steal lens activation.
## Accessibility
- The rail is a labelled `tablist`; icons have accessible labels and visible tooltips.
- The active panel is the associated `tabpanel`; focus is not moved into it merely because selection changed.
- Keyboard activation, close, resize, result traversal, and reveal work without pointer input.
- The resize handle has separator semantics, a value, keyboard increments, and bounded dimensions.
- Loading, stale, conflict, and completion changes are announced without repeatedly announcing ordinary cursor movement.
- Lists preserve logical order and focus when virtualized. At 200% and 400% zoom, controls reflow without clipping the active result or hiding status text.
- Availability is not communicated by color alone, and disabled items explain why.
## Required tests
### Registry and shell
- Assert the ten IDs, labels, icon tokens, order, and single default exactly.
- Assert duplicate IDs, duplicate order values, multiple defaults, and unknown providers fail validation.
- Restore each valid per-tab lens; repair an unknown value to `info`.
- Confirm selection changes never activate another lens.
### Binding lifecycle
- Activation, cancellation, deactivation, and disposal leave no subscriptions or late writes.
- Switching rapidly between lenses cannot render an earlier response.
- Each state—loading, ready, empty, stale, unavailable, forbidden, recoverable error—has an accessible rendering and retry behavior.
### Contract and security
- All persisted actions produce typed, Project-scoped commands with expected revision and submission ID.
- Caller-blind search, comments, references, tasks, or history results are rejected.
- Permission removal, resource deletion, revision conflict, offline retry, and duplicate submission reconcile safely.
- Navigation targets resolve from stable IDs after local and remote edits.
### Interaction and accessibility
- Rail keyboard behavior, focus return, resize, zoom, screen-reader labels, virtualized result focus, and live announcements pass automated and manual checks.
- Workspace reopen and Ω-027 undo/redo restore the lens and a valid reveal target without activating a different lens.
## Current-to-target migration
Taurus Alpha at `d2b1bdcd02307f29ab4a895232cbf857d8157a56` already defines the exact registry in `src/lib/features/stages/document/model/panels.ts`. Preserve it.
1. Replace route-provided `activeSurface.context` component arrays with the static definitions above.
2. Move data access and actions behind an injected per-resource `DocumentContextController`.
3. Retain the proven `SidePanel` / `PanelResults` shell and fixed-header, scrolling-results behavior.
4. Keep the stable IDs `layout` and `name-manager`; document them as the Design and Variables authorities rather than creating duplicate lenses.
5. Move lens ownership out of component-local or singleton session state and persist only the active ID per Workspace tab.
6. Add honest common states, cancellation, keyboard resizing, stable-target reveal, and Project-scoped typed commands.
7. Connect automatic indexing, Comments, References, Formula names, Templates, Tasks, and History only after their Ω-017 authorization and revision contracts are available.
Ω-017 closes backend and Project integration gaps; it does not authorize a visual redesign of the Document editor. Centralized styling remains governed by the existing styling authorities.
## Acceptance
Document Context is complete when:
- exactly the ten registered lenses render in deterministic order with `info` as default;
- every lens consumes an injected binding and has no direct persistence or transport dependency;
- the active lens survives selection changes and valid Workspace restoration;
- each lens reads only caller-authorized Project/Document projections and emits typed operations;
- stable reveals survive revision changes or degrade to an explicit safe fallback;
- no lens duplicates Inspector, another capability's domain authority, or retired pagination/block chrome;
- lifecycle, conflict, permission, offline, accessibility, and Ω-027 restoration tests pass.
## Sources
- [System — Context Rail & Lens Runtime](https://app.notion.com/p/3adb6410e5028109af17d131af989809)
- [System — Inspector & Selection Runtime](https://app.notion.com/p/3adb6410e5028189b4dcf8a6c7bda400)
- [Ω-017 — Close the Document Project vertical slice](https://app.notion.com/p/3adb6410e50281999781e35c8dfacd05)
- [Ω-027 — Extend Workspace history coordination](https://app.notion.com/p/3acb6410e50281e5a7b8f2ff2506c397)
- [Document outcome checklist](https://app.notion.com/p/3a5b6410e50281d58042cde7c2b7e516)
- [Current Document panel registry](https://github.com/gccurtis/taurus-alpha/blob/d2b1bdcd02307f29ab4a895232cbf857d8157a56/src/lib/features/stages/document/model/panels.ts)

