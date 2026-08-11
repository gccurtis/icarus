---
title: "System — Context Rail & Lens Runtime"
notion_page_id: "3adb6410e5028109af17d131af989809"
notion_url: "https://app.notion.com/3adb6410e5028109af17d131af989809"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 05:31:05Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# System — Context Rail & Lens Runtime

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Decision:** Context is the map of material and structures available to the active surface. It is a stable, user-chosen vertical lens rail. Selection may change what a lens shows, but it never steals the chosen lens.
## Boundary
Context answers questions such as:
- What is this resource or Project?
- What structures, sections, slides, spreadsheet ranges, turns, references, tasks, comments, and history are available?
- Where am I, and where can I navigate?
- What supporting material can I bring into the current work?
Context is not:
- the current selection’s property editor;
- the user-level Personal Context library;
- a generic command palette;
- the AI conversation;
- a place for arbitrary settings.
The center work surface owns creation/editing. Inspector owns the selected subject. Quarterback owns AI coordination.
## Shell anatomy
The shared SidePanel mechanics provide:
- labelled Context region;
- collapsed/expanded state;
- vertical icon rail;
- active-lens indication;
- keyboard roving and activation;
- resize handle;
- fixed lens header;
- one scrolling results/content region;
- loading/empty/offline/error/read-only/conflict states;
- focus entry, exit, and restoration.
Context and Inspector may share this chrome. They do not share a controller, registry, or subject model.
## Lens registry
```typescript
interface ContextLensDefinition<ViewModel = unknown> {
  id: string;
  label: string;
  icon: IconKey;
  order: number;
  default?: boolean;
  isAvailable(context: ContextLensAvailability): boolean;
  createBinding(context: ContextLensContext): ContextLensBinding<ViewModel>;
}

interface ContextLensAction {
  type: string;
}

interface ContextLensActionPort<Action extends ContextLensAction, Outcome> {
  dispatch(action: Action): Promise<Outcome>;
}

interface ContextLensBinding<
  ViewModel,
  Action extends ContextLensAction,
  Outcome
> {
  readonly state: Readable<Loadable<ViewModel>>;
  readonly actions: ContextLensActionPort<Action, Outcome>;
  activate(): void;
  deactivate(): void;
  dispose(): void;
}

interface ContextSurfaceDefinition {
  surfaceId: string;
  lenses: readonly ContextLensDefinition[];
}
```
The application composition registers definitions statically. The active surface returns its declared set. Workspace persists only `lensId`; labels, icons, ordering, components, clients, and callbacks remain runtime code.
A resource can omit an unavailable lens. It may not silently reuse an ID with different meaning. IDs are namespaced by surface family where collisions would be ambiguous.
## Activation
1. Shell resolves the active tab’s Context surface.
2. It filters lenses by capability, permission, and resource state.
3. It repairs a missing or unavailable persisted lens to the declared default.
4. Arrow keys move the roving focus; Enter/Space activates. Pointer click activates directly.
5. Workspace predicts the semantic `select-context-lens(tabId, lensId)` intent and compiles it into the governing `set_panel_view` operation.
6. The old binding deactivates; the new binding activates.
7. Lens data may load lazily and is generation-fenced.
8. Focus moves into content only through an explicit action; activation itself keeps focus on the rail unless the user requested reveal.
Manual keyboard activation avoids expensive/unintended lens changes while navigating the rail. A surface may opt into automatic activation only when every lens is immediate and that behavior is tested.
## Stable lens law
- Clicking or keyboard-selecting an editor object does not switch Context lenses.
- A Search lens may update its current result target from selection/reveal without becoming Outline.
- An Outline lens may highlight the selected heading while remaining Outline.
- Project Overview selections update project Context lens content without replacing the active lens.
- Quarterback reveal can open Context and activate a lens only when the user accepted an explicit reveal action; it is not a side effect of model output.
## Surface membership
The shared runtime owns no universal content lenses. Each surface authority owns membership and order.
### Project/Overview
Ω-018 supplies the stable Project Overview capability descriptors:
1. `project.details`;
2. `project.resources`;
3. `project.activity`;
4. `project.tasks`;
5. `project.health`.
Alpha owns their labels, icons, order projection, and views; Omega owns capability availability and caller-safe data. The `project.tasks` section must be re-certified after Ω-019 lands the Project Agent/Task model. Organization members and Project access administration belong to control-plane settings and are never a default Project execution Context lens.
### Document
<mention-page url="https://app.notion.com/p/3adb6410e502810dae4ae1b4866d8c6d"/> is the current Primary authority for exact Document Context lens membership, ordering, models, operations, and states. This shared page governs the rail/binding mechanics and must support that authority without encoding its content.
### Spreadsheet, Slides, and Chat
Their current Yesod Primary Context pages own exact lenses, ordering, states, and operations:
- <mention-page url="https://app.notion.com/p/3acb6410e502814584bad00b5c03397f"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281ae9244e2f9a57f579f"/>
- <mention-page url="https://app.notion.com/p/3acb6410e5028173a1d0c6266bbe87c9"/>
The shared runtime must support those authorities without hard-coded resource-kind switches.
## Lens composition
A lens is normally split into:
- **definition:** stable ID, label, icon, availability;
- **controller/binding:** queries, derived view model, typed actions, reveal behavior;
- **view:** component receiving the view model and callbacks;
- **fixed head:** title, scoped search/filter/action controls;
- **results/content:** the only scroll region;
- **state views:** loading, empty, offline, fault, permission, conflict.
A lens component does not read global Project or editor singleton stores. The binding is created with the active Project/resource runtime and selection service.
## Reveal contract
```typescript
interface ContextRevealRequest {
  lensId: string;
  target: StableContextTarget;
  focus: "rail" | "head" | "content" | "preserve";
  reason: "user-action" | "search-result" | "history" | "ai-suggestion";
}

interface ContextRevealResult {
  activated: boolean;
  targetFound: boolean;
  focusApplied: boolean;
}
```
Reveal uses stable resource identifiers. It may scroll/highlight a result. It does not mutate domain state. AI-originated reveal remains a proposed UI effect until the user or policy accepts it.
## Resizing and persistence
The shell owns the resize interaction. Pointer movement updates a local preview; pointer up commits a coalesced Workspace width command. The separator is focusable and supports keyboard increments/reset. Values are clamped by centralized shell geometry tokens. Context cannot define private numeric bounds.
Collapse state and active lens are per tab. Width is workspace-wide unless the Workspace authority later introduces a versioned per-surface preference.
## Loading and permissions
A lens declares stale and partial data explicitly. Restricted rows are omitted by authorized backend queries; the frontend never uses hidden rows and CSS to enforce access. Permission loss invalidates the binding, repairs the active lens if necessary, and preserves focus through a safe shell target.
Empty and unavailable are different:
- empty: the lens is valid but contains no items;
- unavailable: capability/permission/resource state excludes the lens;
- unsupported: the Resource adapter cannot implement it;
- offline: known cached content may be shown as stale;
- failed: retry/recovery is offered.
## Svelte composition sketch
```javascript
<SidePanel
  region="context"
  open={!workspaceTab.view.context.collapsed}
  width={workspace.chrome.contextWidthPx}
  onresizepreview={contextResize.preview}
  onresizecommit={contextResize.commit}
>
  {#snippet rail()}
    <ContextRail
      lenses={contextModel.lenses}
      activeId={contextModel.activeId}
      onactivate={contextController.activate}
    />
  {/snippet}

  {#snippet body()}
    <ContextLensHost binding={contextModel.binding} />
  {/snippet}
</SidePanel>
```
## Current Alpha migration
Retain `SidePanel.svelte`, `PanelResults`, stable section IDs, and the current fixed-head/scrolling-results pattern. Replace:
- `activeSurface.context` arrays carrying component constructors with typed Context definitions;
- no-prop panels reading global singleton stores with injected bindings;
- project-global `contextSection` with per-tab Workspace lens state;
- pointer-only resizing with the shared accessible resize controller;
- duplicated lens error/loading logic with common state components.
Keep feature-specific controller logic, including the Document and Overview session/action seeds, but bind it to explicit runtime scope.
## Completion tests
Test unavailable persisted lens repair, order stability, keyboard roving/manual activation, pointer activation, focus after collapse/expand, selection changes without lens theft, lazy-load cancellation, Project/tab switch, resize preview/commit, offline/stale/error/empty/read-only states, permission loss, reveal behavior, and no subscription leaks.
## Sources
- <mention-page url="https://app.notion.com/p/3adb6410e50281b88424fd8694de4740"/>
- <mention-page url="https://app.notion.com/p/e12b6939dbc444698aca18d4162bab10"/>
- <mention-page url="https://app.notion.com/p/393b6410e50281f4bb2ceb9db21f794b"/>
- <mention-page url="https://app.notion.com/p/3a5b6410e50281d58042cde7c2b7e516"/>
- [Current Alpha panel composition](https://github.com/gccurtis/taurus-alpha/blob/d2b1bdcd02307f29ab4a895232cbf857d8157a56/src/lib/features/shell/shell-sections.ts)

