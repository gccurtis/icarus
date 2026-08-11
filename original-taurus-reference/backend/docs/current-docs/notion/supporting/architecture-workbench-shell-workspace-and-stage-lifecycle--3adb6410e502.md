---
title: "Architecture — Workbench Shell, Workspace & Stage Lifecycle"
notion_page_id: "3adb6410e50281b88424fd8694de4740"
notion_url: "https://app.notion.com/3adb6410e50281b88424fd8694de4740"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 05:31:05Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Architecture — Workbench Shell, Workspace & Stage Lifecycle

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Decision:** The workbench shell is a composition runtime around a canonical user×Project Workspace. The shell owns geometry and active-surface lifecycle; Resource modules contribute typed adapters. Resource views never own tabs or global panels.
## Shell anatomy
The Project execution screen composes:
1. shell top bar;
2. Workspace tab strip;
3. left Context panel;
4. center Work Surface;
5. right adaptive Inspector;
6. bottom Quarterback dock;
7. status and notification surfaces;
8. one application overlay host.
These are cognitive regions, not independent applications. The active tab is the composition root for Context, center stage, Inspector, and default AI scope.
## State ownership
<table header-row="true">
<tr>
<td>State</td>
<td>Owner</td>
</tr>
<tr>
<td>tab IDs, order, active tab, open resource references</td>
<td>Omega Workspace</td>
</tr>
<tr>
<td>workspace-wide Context/Inspector widths</td>
<td>Omega Workspace</td>
</tr>
<tr>
<td>per-tab Context chosen lens and collapse state</td>
<td>Omega Workspace</td>
</tr>
<tr>
<td>per-tab Inspector open state and stable selection target envelope</td>
<td>Omega Workspace where durable; current live selection in Resource runtime</td>
</tr>
<tr>
<td>per-tab viewport/zoom/scroll/view preferences</td>
<td>Omega Workspace, coalesced</td>
</tr>
<tr>
<td>resource content and revision</td>
<td>resource capability/Omega</td>
</tr>
<tr>
<td>live selection, hover, caret, drag, IME</td>
<td>Resource interaction runtime</td>
</tr>
<tr>
<td>overlay stack, focus restoration</td>
<td>application overlay runtime</td>
</tr>
<tr>
<td>Quarterback prompt draft</td>
<td>AI interaction runtime; selectively draft-persisted by explicit policy</td>
</tr>
<tr>
<td>presence and remote cursors</td>
<td>ephemeral collaboration channel</td>
</tr>
<tr>
<td>shell token geometry</td>
<td>centralized design token source</td>
</tr>
</table>
## Workspace projection
```typescript
interface WorkspaceProjection {
  workspaceId: string;
  userId: string;
  projectId: string;
  slotKey: "default";
  revision: number;
  tabs: readonly WorkspaceTab[];
  activeTabId: string;
  chrome: {
    contextWidthPx: number;
    inspectorWidthPx: number;
  };
}

type WorkspaceTab =
  | {
      id: string;
      kind: "system";
      system: { viewId: string }; // overview, agents; registry-owned
      view: WorkspaceTabView;
    }
  | {
      id: string;
      kind: "launcher";
      launcher: ResourceViewStateEnvelope;
      view: WorkspaceTabView;
    }
  | {
      id: string;
      kind: "resource";
      resource: { id: string; kind: ResourceKind };
      view: WorkspaceTabView;
    };

interface WorkspaceTabView {
  context: { collapsed: boolean; activeLensId: string };
  inspector: { collapsed: boolean; target?: InspectorTargetEnvelope };
  resource?: ResourceViewStateEnvelope;
}
```
The Workspace persists identifiers and serializable envelopes, never Svelte components, editor instances, DOM nodes, live selections, or runtime callbacks. Temporary AI takeover is not persisted as a replacement for the stable Inspector selection.
## Workspace controller
Structural commands submit immediately and serialize per Workspace:
- open or activate a Resource tab by stable Resource identity;
- open a launcher tab;
- resolve a launcher into a Resource while preserving its Tab ID;
- close a tab, close others, or close right;
- activate a tab;
- move tabs by stable Tab IDs and a stable before-tab anchor;
- set the active Context lens;
- collapse/expand Context or Inspector;
- set an Inspector target envelope when the Resource defines a durable target;
- navigate backward/forward through unified history.
System tabs are pinned in registry order and cannot be closed. There is no client pin/unpin command. Deliberate reordering is undoable; high-frequency view, panel, and geometry synchronization is revisioned but does not enter user undo.
High-frequency view commands are coalesced:
- panel resizing;
- zoom;
- scroll/viewport;
- split ratio;
- resource-specific view options.
Coalescing changes submission frequency, not authority. The latest acknowledged state remains revisioned and conflict-safe.
## Runtime acquisition
```typescript
interface ResourceStageModule<R extends ResourceRuntime = ResourceRuntime> {
  kind: ResourceKind;
  acquire(context: ResourceAcquireContext): Promise<RuntimeHandle<R>>;
  createStage(runtime: R): StageAttachment;
  contextLenses(runtime: R): readonly ContextLensDefinition[];
  resolveInspector(runtime: R, selection: SelectionEnvelope | null): InspectorModel;
  actions(runtime: R): readonly ActionDefinition<unknown, unknown>[];
}

interface StageRegistry {
  register(module: ResourceStageModule): void;
  resolve(kind: ResourceKind): ResourceStageModule;
}

interface StageAttachment {
  mount(host: HTMLElement): void;
  setVisibility(visible: boolean): void;
  focus(target?: FocusTarget): void;
  destroy(): void;
}
```
Registration is static application composition, not remotely executable plugins. Unknown kinds render a typed unsupported stage with metadata and recovery; they never fall through to a generic unsafe renderer.
## Active-tab transition
1. User emits an activate-tab intent.
2. Workspace predicts the active tab and submits the command.
3. Shell resolves the tab’s module through the Stage registry.
4. Project Resource registry acquires or reuses the Resource runtime.
5. The old stage detaches; pending resource operations continue.
6. The new stage attaches and publishes Context definitions plus its Inspector resolver.
7. Shell repairs unavailable persisted Context lens IDs to the surface’s declared default.
8. Focus follows the reason for activation: pointer selection preserves natural focus; keyboard activation moves to the stage heading/host according to policy.
9. Workspace acceptance/rejection reconciles tab state without recreating resource content.
## Stage lifecycle
A stage owns DOM and view-engine resources only:
- editor/canvas/grid instance;
- ResizeObserver and measurement;
- local render cache;
- input-method composition;
- view-only keyboard bindings;
- focus target mapping.
A Resource runtime owns resource state and pending work. Unmounting a stage must not drop pending operations. A hidden stage may suspend expensive rendering, but it cannot dispose the runtime while its tab owns it.
Closing the last owning tab calls the resource’s close policy:
- flush immediately safe buffered edits;
- wait within a bounded deadline;
- retain a pending operation in the runtime/outbox only if that policy exists;
- prompt when genuinely necessary;
- release subscriptions and engine resources deterministically.
## Context and Inspector composition
Context and Inspector share SidePanel mechanics but not meaning.
- Context exposes a stable, resource-declared icon rail. The user chooses a lens. Selection changes lens content but never steals the chosen lens.
- Inspector is one adaptive selection-driven surface. It resolves controls from the active resource and current selection. It is not a fixed registry of universal facets.
- Quarterback may temporarily take over Inspector and then restore the stable selection model.
- Closing Inspector does not clear editor selection.
- Shell widths are clamped by centralized layout tokens. A resource may declare a preferred width within those bounds but may not create new min/max constants.
## Scroll and layout ownership
The shell fills the viewport. Context and Inspector each own one internal scrolling results region. The center stage owns its own scroll strategy; the shell does not wrap all editors in a competing scroll container.
Fixed heads remain fixed within their region. Floating menus and overlays portal to the overlay host rather than being clipped by stage or panel overflow. Resize handles expose pointer and keyboard interaction.
## Work Surface modules
<table header-row="true">
<tr>
<td>Surface</td>
<td>Runtime</td>
</tr>
<tr>
<td>Overview</td>
<td>Project metadata/resource/activity projection; no fake Resource runtime</td>
</tr>
<tr>
<td>Project Agents</td>
<td>Project Agent/task projection and interaction controller</td>
</tr>
<tr>
<td>New Tab</td>
<td>Resource creation/import controller</td>
</tr>
<tr>
<td>Document</td>
<td>Document runtime + ProseMirror adapter</td>
</tr>
<tr>
<td>Spreadsheet</td>
<td>Spreadsheet runtime + grid/formula adapter</td>
</tr>
<tr>
<td>Slides</td>
<td>Slides runtime + canvas/object adapter</td>
</tr>
<tr>
<td>Chat</td>
<td>Chat turn-tree runtime + conversation adapter</td>
</tr>
<tr>
<td>Preview</td>
<td>read-only resource/file adapter with capability-safe actions</td>
</tr>
<tr>
<td>Unsupported</td>
<td>metadata/error recovery only</td>
</tr>
</table>
Overview and Project Agents are registry-owned `system` tabs. New Tab is a `launcher` that resolves atomically into a Resource tab without changing its Tab ID. Preview uses a `resource` tab backed by a read-only file/media adapter; it is not a fourth Workspace tab kind. Their view attachments still register through the shell module boundary.
## Multi-Project browser behavior
Each browser tab or window is an independent frontend application instance unless a future, explicitly designed SharedWorker architecture says otherwise. Within one instance, the application registry may retain runtimes for several Projects and `acquire(projectId)` reuses at most one frontend Project runtime for that Project. It never shares that in-memory object implicitly across browser tabs or windows.
Separate clients for the same User and Project address the same logical Omega `(UserID, ProjectID)` Project Subcell and converge through canonical aggregate revisions plus the durable Project change cursor. Durable Workspaces for different Projects coexist, and every request includes ProjectID. This replaces ambient `openProject()` behavior, which lets browser clients retarget shared session scope.
## Status and recovery
The shell exposes a unified status model with scope:
- Workspace saving/retrying/conflicted;
- active resource saving/retrying/read-only/conflicted;
- Project connectivity/admission;
- AI job/task state;
- presence connectivity.
A global “saved” label must identify which aggregate it describes. Errors offer recovery at the narrowest owning layer. Resource failure does not tear down the whole Project runtime; admission loss does.
## Current Alpha migration notes
- retain `AppShell`, `TabStrip`, `SidePanel`, `WorkSurface`, and the Resource registry as strong seeds;
- replace the hard-coded `WorkSurface` switch with the Stage registry;
- split `data/workspace.ts` into model, controller, cache, transport, and sync;
- replace opaque whole-state PUT with typed Workspace commands;
- replace project-global panel state with per-tab state;
- replace no-prop singleton panel sessions with runtime-bound controller/view models;
- remove or adopt the currently unused `services/project-runtime.ts`; do not keep two project-runtime stories;
- preserve the Document runtime across view detachments and make it the reference implementation for other Resource kinds.
## Sources
- <mention-page url="https://app.notion.com/p/3adb6410e50281ff9601e70217f36c96"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502815497b0e1c1c60ef284"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281ddaa6dca8f6e1802fb"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281d2813fe9f261c35ac4"/>
- [Current Alpha shell](https://github.com/gccurtis/taurus-alpha/tree/d2b1bdcd02307f29ab4a895232cbf857d8157a56/src/lib/features/shell)
- [Current Alpha Resource runtime registry](https://github.com/gccurtis/taurus-alpha/blob/d2b1bdcd02307f29ab4a895232cbf857d8157a56/src/lib/systems/resources/registry.ts)

