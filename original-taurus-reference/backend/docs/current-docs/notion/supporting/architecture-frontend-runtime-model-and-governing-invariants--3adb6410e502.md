---
title: "Architecture — Frontend Runtime Model & Governing Invariants"
notion_page_id: "3adb6410e50281ff9601e70217f36c96"
notion_url: "https://app.notion.com/3adb6410e50281ff9601e70217f36c96"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 05:31:05Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Architecture — Frontend Runtime Model & Governing Invariants

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Decision:** Alpha has a small hierarchy of explicit runtimes. A runtime is a stateful coordinator with a declared scope, lifecycle, inputs, outputs, and disposal rule. It is not a component tree, global event bus, backend cell, or synonym for every store.
## Purpose
The frontend runtime exists to keep a responsive local projection coherent while a user moves among control-plane screens, Projects, tabs, resources, panels, and AI workflows. It draws a hard boundary between:
- **projection synchronization;**
- **user-interaction coordination;**
- **presentation and accessibility;**
- **transport;** and
- **Omega’s canonical execution.**
The three core frontend responsibilities are synchronization, interaction, and operation submission. All other frontend behavior composes around those responsibilities.
## Runtime hierarchy
### Application runtime
One per browser application instance—normally one browser tab or window. Frontend memory is not shared across browser tabs/windows unless a future architecture explicitly introduces and secures a SharedWorker or equivalent coordinator. It owns:
- authenticated-session projection and refresh;
- route/scope coordination;
- a registry of Project runtime handles;
- control-plane clients for user, organization, directory, settings, and user libraries;
- the global overlay, focus, notifications, connectivity, and telemetry services;
- cancellation roots and application-wide error recovery.
It does not own Project resource content, Workspace state, or organization permission policy.
### Control-plane projection runtimes
Acquired by signed-in routes as needed. These are bounded query/command coordinators for:
- Project directory and project selection;
- account and license presentation;
- user Context, Template, and Personality libraries;
- organization administration;
- project metadata and grant administration.
They may remain cached after route exit, but route-bound subscriptions and transient drafts are released. Opening an admin page does not acquire a Project Subcell or imply Project content access.
### Project runtime
Keyed by explicit `ProjectID`, not by the session. It owns:
- admitted Project metadata projection;
- Resource catalog and Activity projections;
- the user×Project Workspace controller;
- resource-runtime registry;
- Project-scoped AI coordinator;
- Project connection/reconnect state;
- durable revision/CAS and Project change-cursor reconciliation for all Project work.
One application instance acquires at most one runtime object for a given ProjectID and reference-counts consumers. That reuse never crosses browser-instance memory boundaries implicitly. Multiple browser clients for the same User may independently host frontend Project-runtime projections while addressing the same logical Omega `(UserID, ProjectID)` Project Subcell. A different User on the same Project addresses a different subcell; shared canonical state converges through revisions and the durable Project change cursor.
### Resource runtime
Keyed by `(ProjectID, ResourceID, ResourceKind)` and acquired by an open Workspace tab. It owns:
- the confirmed resource projection and revision;
- optimistic resource operations;
- resource-specific selection/viewport model;
- operation compilation;
- history integration;
- Context definitions and Inspector resolver;
- optional editor engine integration.
It survives stage remounts while its tab remains open. Closing the last owning tab releases it after pending-operation policy is resolved. Switching Projects never allows an old runtime result to enter the new Project generation.
### View attachment
A stage component is a view attachment to a Resource runtime. It owns DOM bindings, rendering adapters, local measurement, and view-only state. It does not own the resource’s canonical replica. ProseMirror and any packet-selected canvas/grid engines live here and in their resource adapters; they are not application-wide state managers. The architecture does not preselect the Slides engine.
## State taxonomy
Every frontend state field must be classified before implementation.
<table header-row="true">
<tr>
<td>Class</td>
<td>Example</td>
<td>Owner</td>
<td>Persistence</td>
</tr>
<tr>
<td>Canonical projection</td>
<td>Document revision, Project grants, Agent task state</td>
<td>Omega; mirrored by runtime</td>
<td>backend</td>
</tr>
<tr>
<td>Confirmed replica</td>
<td>last acknowledged Document/Workspace state</td>
<td>projection runtime</td>
<td>memory + acknowledged cache where allowed</td>
</tr>
<tr>
<td>Optimistic overlay</td>
<td>pending title change, pending document op</td>
<td>projection runtime</td>
<td>memory; optional durable outbox only by explicit design</td>
</tr>
<tr>
<td>Durable personal Workspace</td>
<td>tabs, order, active tab, per-tab lens/view state</td>
<td>Omega Workspace</td>
<td>backend; cached locally</td>
</tr>
<tr>
<td>Interaction draft</td>
<td>unsaved form text, prompt draft, drag candidate</td>
<td>feature interaction runtime</td>
<td>normally memory; selective local draft persistence</td>
</tr>
<tr>
<td>Ephemeral presentation</td>
<td>hover, tooltip, focus ring, resize pointer</td>
<td>component/view</td>
<td>DOM/component lifetime</td>
</tr>
<tr>
<td>Derived view</td>
<td>filtered rows, active Inspector model</td>
<td>selector/resolver</td>
<td>recomputed</td>
</tr>
<tr>
<td>Capability/runtime health</td>
<td>loading, offline, retrying, conflict</td>
<td>runtime</td>
<td>memory, observable</td>
</tr>
</table>
If a field cannot be placed in exactly one class, its ownership is unresolved.
## Dependency direction
```plain text
route
  → feature composition
    → interaction controller
      → runtime command
        → system/data client
          → Omega endpoint

Omega projection
  → runtime reducer/reconciler
    → selectors/view models
      → component props

component semantic event
  → interaction controller
```
Allowed dependencies point inward toward contracts and downward toward transport. The following imports are forbidden:
- components importing API clients or system stores;
- runtimes importing Svelte components;
- system clients importing feature modules;
- Resource runtimes importing the workbench shell;
- one resource capability importing another resource capability;
- control-plane screens importing Project Workspace state merely to determine authority.
## Reference contracts
```typescript
type RuntimeScope =
  | { kind: "application" }
  | { kind: "control-plane"; routeKey: string }
  | { kind: "project"; projectId: string }
  | {
      kind: "resource";
      projectId: string;
      resourceId: string;
      resourceKind: ResourceKind;
    };

interface RuntimeHandle<T> {
  readonly key: string;
  readonly scope: RuntimeScope;
  readonly value: T;
  release(): void;
}

interface RuntimeRegistry<K, T> {
  acquire(key: K): RuntimeHandle<T>;
  peek(key: K): T | undefined;
  dispose(key: K, reason: DisposalReason): Promise<void>;
}

interface ObservableRuntime<S, C> {
  snapshot(): S;
  subscribe(run: (state: S) => void): () => void;
  dispatch(command: C): Promise<CommandOutcome>;
}
```
The contracts do not require one global class hierarchy. Small composable controllers and stores may implement them. The important properties are explicit scope, ownership, acquisition, observable state, command surface, and disposal.
## Lifecycle law
<table header-row="true">
<tr>
<td>Event</td>
<td>Application</td>
<td>Project</td>
<td>Resource</td>
<td>View</td>
</tr>
<tr>
<td>app boot</td>
<td>construct; restore session</td>
<td>none yet</td>
<td>none</td>
<td>route shell</td>
</tr>
<tr>
<td>enter user route</td>
<td>acquire control-plane projection</td>
<td>unchanged</td>
<td>unchanged</td>
<td>route component</td>
</tr>
<tr>
<td>enter Project</td>
<td>admit Project; acquire by ProjectID</td>
<td>load Workspace/catalog</td>
<td>acquire active-tab resources</td>
<td>mount active stage</td>
</tr>
<tr>
<td>open tab</td>
<td>unchanged</td>
<td>apply Workspace command</td>
<td>acquire resource</td>
<td>mount if active</td>
</tr>
<tr>
<td>change active tab</td>
<td>unchanged</td>
<td>apply Workspace command</td>
<td>keep open runtimes</td>
<td>detach old/attach new</td>
</tr>
<tr>
<td>close tab</td>
<td>unchanged</td>
<td>apply Workspace command</td>
<td>release; dispose when unowned</td>
<td>unmount</td>
</tr>
<tr>
<td>navigate to another Project</td>
<td>keep both if referenced; fence route work</td>
<td>acquire target; release old route reference</td>
<td>old tab runtimes follow old Workspace ownership</td>
<td>remount target</td>
</tr>
<tr>
<td>sign out</td>
<td>cancel all; clear sensitive caches</td>
<td>release all</td>
<td>resolve/cancel pending work</td>
<td>unmount</td>
</tr>
<tr>
<td>fatal schema/version mismatch</td>
<td>show upgrade/recovery boundary</td>
<td>stop mutation</td>
<td>preserve diagnosable state</td>
<td>no unsafe rendering</td>
</tr>
</table>
Project switching cancels and generation-fences active requests and transients. It does not delete durable Workspaces or assume the previous Project no longer exists.
## Core invariants
1. **Omega is canonical.** Alpha may predict but cannot grant permission or manufacture accepted state.
2. **Project scope is explicit.** No resource call derives its authority from a mutable selected-project session field.
3. **One owner per state field.** Components may bind to owned values; binding does not transfer authority.
4. **No invisible cross-scope mutation.** Bringing a library asset into a Project names that Project.
5. **Runtime outlives view when required.** Closing a panel cannot cancel a resource save.
6. **View engines remain bounded adapters.** ProseMirror transactions do not become the application operation protocol.
7. **Disposal is observable and testable.** Every subscription, abort controller, timer, editor view, and global listener has a release path.
8. **Errors are state.** Loading, stale, offline, retrying, refused, conflicted, and unsupported are modeled, not inferred from missing data.
9. **Accessibility is runtime behavior.** Focus restoration and announcements are coordinated effects, not decorative component details.
10. **No universal event bus.** Typed commands and narrow subscriptions preserve ownership and traceability.
## Sources
- <mention-page url="https://app.notion.com/p/3adb6410e502818fb987d5f5004117e3"/>
- <mention-page url="https://app.notion.com/p/3acb6410e502812bb4e0ff2c91ff753f"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281988386c4559a26cd22"/>
- <mention-page url="https://app.notion.com/p/3acb6410e5028147909ef7214406baad"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281ddaa6dca8f6e1802fb"/>
- [Svelte lifecycle hooks](https://svelte.dev/docs/svelte/lifecycle-hooks)
- [Svelte context](https://svelte.dev/docs/svelte/context)
- [Taurus Alpha architecture orientation](https://github.com/gccurtis/taurus-alpha/blob/d2b1bdcd02307f29ab4a895232cbf857d8157a56/docs/orientation/AGENT-ORIENTATION.md)

