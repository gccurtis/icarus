---
title: "System — Resource Editor Host & Adapter Contract"
notion_page_id: "3adb6410e50281dca00fe935ccb4b083"
notion_url: "https://app.notion.com/3adb6410e50281dca00fe935ccb4b083"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 05:31:05Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# System — Resource Editor Host & Adapter Contract

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Decision:** Every editable or previewable Resource enters the workbench through a typed Resource module. The module composes a canonical replica, interaction controller, engine adapter, Context definitions, Inspector resolver, actions, and transfer capabilities. The editor engine is an implementation detail behind the adapter.
## Boundary
```plain text
Omega resource projection
  → Resource replica
    → Resource domain projection
      → editor adapter
        → engine/DOM view

engine local-user transaction
  → adapter translation
    → typed Resource operation
      → replica submit
        → Omega

selection
  → adapter stable envelope
    → Resource interaction runtime
      → Inspector resolver
```
The workbench shell knows only the Resource module contract. It does not import ProseMirror, a spreadsheet grid, a Slides canvas engine, or Chat internals.
## Module contracts
```typescript
type EditorOrigin =
  | "bootstrap"
  | "local-user"
  | "remote"
  | "reconcile"
  | "local-ack";

interface ResourceEditorModule<State, Operation, Selection> {
  kind: ResourceKind;
  createRuntime(context: ResourceRuntimeContext): ResourceRuntime<State, Operation>;
  createAdapter(context: EditorAdapterContext<Operation, Selection>): EditorAdapter<State, Selection>;
  contextLenses(runtime: ResourceRuntime<State, Operation>): readonly ContextLensDefinition[];
  inspector(runtime: ResourceRuntime<State, Operation>): InspectorResolver;
  actions(runtime: ResourceRuntime<State, Operation>): readonly ActionDefinition<unknown, unknown>[];
  transfers?: ResourceTransferAdapter;
}

interface EditorAdapter<State, Selection> {
  mount(host: HTMLElement, initial: Readonly<State>): void;
  applyProjection(
    next: Readonly<State>,
    origin: Exclude<EditorOrigin, "local-user">
  ): void;
  setMode(mode: "editable" | "read-only" | "disabled"): void;
  getSelection(): Selection | null;
  focus(target?: FocusTarget): void;
  suspend?(): void;
  resume?(): void;
  destroy(): void;
}

interface EditorAdapterContext<Operation, Selection> {
  emitOperations(
    operations: readonly [Operation, ...Operation[]],
    metadata: OperationMetadata
  ): void;
  selectionChanged(selection: Selection | null): void;
  emitIntent(intent: ResourceUiIntent): void;
  reportFault(fault: EditorFault): void;
}
```
Only engine transactions with origin `local-user` may emit Resource operations. Applying `bootstrap`, `remote`, `reconcile`, or `local-ack` projections is echo-proof.
## Resource runtime
The Resource runtime is view-independent. It owns:
- identity, kind, capabilities and mode;
- confirmed projection and revision;
- optimistic operation queue;
- resource-specific reducer/codec;
- derived model/selectors;
- interaction/selection model;
- subscriptions and reconnect;
- unified-history command adapter;
- Context/Inspector controller factories;
- lifecycle and diagnostics.
It does not own DOM, engine instances, focusable elements, or pixel measurement.
The adapter owns:
- engine state required to render and interact;
- DOM mount/destroy;
- local IME/composition;
- engine-native selection;
- clipboard and native drag/drop integration;
- mapping between stable Taurus identity and engine coordinates;
- view measurement and local render scheduling.
## Projection application
An adapter applies a complete or incremental domain projection according to the Resource module’s tested contract. Engine-native transactions are never the wire protocol.
On remote/reconciliation application:
1. capture engine-local selection/composition state;
2. map the canonical change through stable IDs/anchors;
3. apply with a non-user origin;
4. restore a valid mapped selection;
5. notify the interaction runtime only if the semantic selection changed;
6. emit no outbound Resource operation;
7. report unmappable state through typed recovery rather than silently resetting the whole editor.
## Editing and batching
A local engine gesture may produce zero, one, or several typed operations.
- formatting toolbar click and equivalent shortcut call the same action;
- IME composition is not serialized as one operation per intermediate event;
- high-frequency direct manipulation uses preview and one coalesced commit;
- paste/drop imports are validated and converted by the Resource module;
- unsupported engine constructs are refused before prediction;
- cross-resource actions call an explicit Omega transaction contract; the frontend never simulates atomicity.
## Undo and history
Accepted canonical operations are not removed from history. Undo is a new semantic operation or a Workspace unified-history request. The Resource adapter routes undo/redo intent to the runtime.
An engine may maintain temporary internal history only to support uncommitted composition/preview. It cannot expose a second authoritative history that diverges from Omega. Remote operations and acknowledgements are not user-undo entries unless the capability model explicitly says otherwise.
## Resource adapters
<table header-row="true">
<tr>
<td>Resource</td>
<td>Engine/view boundary</td>
<td>Key contract</td>
</tr>
<tr>
<td>Document</td>
<td>ProseMirror</td>
<td>Taurus block/atom/mark operations; stable text/block anchors; comments/references/presence</td>
</tr>
<tr>
<td>Spreadsheet</td>
<td>one-grid/formula UI</td>
<td>stable SpreadsheetID, RowID, ColumnID, CellID and RangeRef; formula/value/display distinction; dependency-aware edits; no nested sheets/tabs</td>
</tr>
<tr>
<td>Slides</td>
<td>engine-neutral canvas/object adapter plus accessible object tree</td>
<td>stable slide/object IDs; selection, geometry preview/commit, z-order; no architecture-level dependency preselection</td>
</tr>
<tr>
<td>Chat</td>
<td>turn-tree/conversation view</td>
<td>stable turn/branch IDs; prompt/response revisions, streaming and branch navigation</td>
</tr>
<tr>
<td>File/media preview</td>
<td>read-only renderer</td>
<td>safe content type, bounded loading, source metadata and citations</td>
</tr>
<tr>
<td>Unsupported</td>
<td>no engine</td>
<td>metadata, download/open-safe action, explanatory recovery</td>
</tr>
</table>
Document is the reference implementation because its current runtime already separates model modules, synchronization, selection, presentation, actions, panels, and a view bridge. That structure should be simplified and generalized, not replaced.
## ProseMirror boundary
ProseMirror intricately connects interaction and rendering by design. The allowed coupling is contained in the Document adapter:
- ProseMirror `EditorState` and `Transaction` remain inside Document editor modules;
- the bridge maps Omega blocks/atoms/marks to/from ProseMirror;
- eligible local transactions compile to Document edits/change sets;
- Document selection maps to stable Taurus anchors;
- remote/ack/reconcile transactions carry explicit origins;
- toolbar, keyboard, Inspector, and commands call one Document action table;
- runtime synchronization continues while the view is detached;
- the shell and generic components never import ProseMirror.
The current whole-document diff after debounced editing is a valid transition mechanism, not the permanent shared editor protocol. The final Document capability contract decides whether it remains or moves to finer-grained operation capture.
## Stage composition
```javascript
<ResourceStageBoundary runtime={runtime}>
  {#snippet pending()}
    <ResourceLoadingState />
  {/snippet}

  {#snippet ready(projection)}
    <EditorHost
      module={module}
      runtime={runtime}
      projection={projection}
    />
  {/snippet}

  {#snippet failed(fault)}
    <ResourceRecoveryState {fault} onretry={runtime.refresh} />
  {/snippet}
</ResourceStageBoundary>
```
A render/effect error boundary isolates a stage. Controller and async errors are still caught and modeled because render boundaries do not cover arbitrary asynchronous handlers.
## Mode changes
Editability is explicit:
- `editable`: user may emit eligible operations;
- `read-only`: content and selection/navigation remain available; mutation actions are absent/disabled with reason;
- `disabled`: projection is unsafe or unavailable; engine input is stopped.
Permission or admission changes update mode without recreating the Resource unless its data must be purged. A refusal remains authoritative even if a stale UI control was visible.
## Lazy loading and memory
Heavy editor modules are lazy-loaded by Resource kind. Resource runtimes and view attachments are reference-counted separately. Inactive views may suspend rendering; runtimes keep pending synchronization alive. A bounded policy may evict unowned/inactive runtimes only after pending work, subscriptions, and recoverability are resolved.
## Accessibility
Every adapter supplies:
- accessible Resource name/status;
- keyboard command map and shortcut help;
- selection description;
- focus and read-only behavior;
- non-pointer equivalents for direct manipulation;
- zoom/reflow or alternate control surface;
- error/recovery semantics;
- screen-reader strategy for virtualized/canvas content.
Slides require an accessible object/slide tree; Spreadsheet requires a complete grid model; neither can be declared complete because the canvas/grid looks correct with a pointer.
## Required contract suite
Every adapter passes:
1. mount and deterministic teardown;
2. local user edit emits exactly the intended operation batch;
3. remote/bootstrap/reconcile/ack application emits no echo;
4. duplicate canonical events are harmless;
5. valid selection survives reconciliation;
6. missing target selection recovers predictably;
7. IME composition;
8. clipboard, paste, and drag/drop;
9. read-only/disabled modes;
10. focus transfer and route/tab detach;
11. undo/redo routing;
12. offline/retry/conflict/refusal;
13. lazy-load failure and render error isolation;
14. Project switch and disposal;
15. accessibility/keyboard/resource-specific semantics.
## Current Alpha migration
- keep Document `runtime.ts`, model modules, `editor/bridge.ts`, session/action table, and resource registry as the reference seam;
- split the 609-line `DocumentStage.svelte` into view attachment, document chrome/controller, presence attachment, and stage composition;
- replace hard-coded stage routing with module registration;
- move Slides types/store/mock CRUD into a proper Resource runtime and Omega adapter;
- implement Spreadsheet and Chat through the same contract rather than placeholders;
- keep ProseMirror and any selected canvas/grid vendor types inside adapter packages; choose or retain a Slides engine only in an implementation packet that verifies fit, security, maintenance, and free/open-source licensing;
- add no-echo origin tags and common adapter tests before migrating behavior;
- do not allow engine transactions or transport DTOs to leak through generic shell contracts.
## Sources
- <mention-page url="https://app.notion.com/p/3adb6410e50281b88424fd8694de4740"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502815497b0e1c1c60ef284"/>
- <mention-page url="https://app.notion.com/p/3adb6410e5028189b4dcf8a6c7bda400"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502810dae4ae1b4866d8c6d"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502816fbecde3c54898886b"/>
- <mention-page url="https://app.notion.com/p/3a5b6410e50281d58042cde7c2b7e516"/>
- [Current Alpha Document architecture](https://github.com/gccurtis/taurus-alpha/blob/d2b1bdcd02307f29ab4a895232cbf857d8157a56/docs/architecture/document-editor.md)
- [ProseMirror guide](https://prosemirror.net/docs/guide/)

