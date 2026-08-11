---
title: "System — Inspector & Selection Runtime"
notion_page_id: "3adb6410e5028189b4dcf8a6c7bda400"
notion_url: "https://app.notion.com/3adb6410e5028189b4dcf8a6c7bda400"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 05:31:05Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# System — Inspector & Selection Runtime

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Decision:** Inspector is one adaptive, selection-driven lens. It resolves the current inspectable subject into ordered sections and controls. It is not a fixed universal facet rail, a generic settings bin, or a second Context registry.
## Boundary
Inspector answers:
- What is selected?
- What properties, metadata, relationships, permissions, and actions apply to it?
- Which values are common, mixed, unavailable, read-only, invalid, or pending?
- What will a previewed property change do?
- How can the user perform a precise operation on this subject?
Context answers what is available around the work. Inspector answers what the current subject is. Selection can exist while Inspector is closed.
## Selection model
Selection belongs to the active Resource or surface interaction runtime. DOM focus and selection are distinct.
```typescript
interface SelectionScope {
  projectId: string;
  resource?: {
    kind: ResourceKind;
    id: string;
  };
}

interface StableInspectableTarget<
  Kind extends string = string,
  Data = unknown
> {
  kind: Kind;
  data: Data;
}

interface SelectionEnvelope<
  Target extends StableInspectableTarget = StableInspectableTarget
> {
  scope: SelectionScope;
  targets: readonly Target[]; // empty means no selection; many means multi-selection
  source: "pointer" | "keyboard" | "programmatic-reveal" | "remote-reconcile";
  version: number;
  accessibleDescription: string;
}
```
The active surface adapter owns the discriminated Target union and its codec; the shared Inspector runtime does not freeze every Resource’s selection vocabulary. Spreadsheet targets use stable SpreadsheetID/RowID/ColumnID/CellID/RangeRef identities and never a `sheetId`, because a Taurus Spreadsheet is one sparse grid. Slides, Chat, Document, Overview, Resource, Activity, and Task adapters likewise define their authority-owned target kinds. Project/Resource scope appears once in the envelope. Stable Taurus IDs and anchors cross the adapter boundary; raw DOM selections, ProseMirror positions, canvas indexes, and array offsets remain engine-local.
## Resolver and sections
```typescript
interface InspectorSectionProvider<
  Target extends StableInspectableTarget,
  ViewModel = unknown
> {
  id: string;
  order: number;
  supports(selection: SelectionEnvelope<Target>, context: InspectorContext): boolean;
  bind(
    selection: SelectionEnvelope<Target>,
    context: InspectorContext
  ): InspectorSectionBinding<ViewModel>;
}

interface InspectorModel<Target extends StableInspectableTarget> {
  selection: SelectionEnvelope<Target>;
  title: string;
  description?: string;
  sections: readonly InspectorSectionModel[];
  status: "ready" | "loading" | "empty" | "offline" | "read-only" | "conflicted" | "error";
}

interface InspectorResolver<Target extends StableInspectableTarget> {
  resolve(
    selection: SelectionEnvelope<Target>,
    context: InspectorContext
  ): InspectorModel<Target>;
}
```
Each Resource module registers section providers. The resolver selects compatible providers, orders them deterministically, and returns a view model. The shell does not know resource kinds or import feature components.
Sections are collapsible disclosure groups within one Inspector. They are not independent rail lenses. Persisting per-section disclosure is optional user preference; section component instances are never persisted.
## No selection and mixed selection
When no inspectable subject exists, the Resource authority chooses one of:
- resource-level summary;
- a clear “Select something to inspect” state;
- a default stable target such as the current slide, Spreadsheet Resource/range, or Chat turn;
- no Inspector content when the surface has no inspectable concept.
Multi-selection resolves only controls valid for the entire selection. Values use explicit models:
```typescript
type PropertyValue<T> =
  | { kind: "same"; value: T }
  | { kind: "mixed" }
  | { kind: "unavailable"; reason: string }
  | { kind: "read-only"; value?: T; reason: string }
  | { kind: "pending"; projected: T; confirmed?: T };
```
Editing a mixed value applies one explicit operation to all eligible stable targets. Partial eligibility is never hidden; the control states exact scope or refuses until the selection is narrowed.
## Control commit protocols
### Discrete controls
Checkboxes, selects, toggles, and button actions emit one typed intent on commit. The controller predicts only when the resource operation defines a safe reducer.
### Text and numeric fields
Fields hold an interaction draft. Commit policy is declared: Enter, explicit Apply, blur, or debounced commit. Escape restores confirmed state. Validation preserves the draft without presenting it as canonical.
### Continuous controls
Sliders, color/geometry controls, and canvas-aligned property edits use preview sessions.
```typescript
interface PreviewSession<T> {
  update(value: T): void;
  commit(): Promise<void>;
  cancel(): void;
}
```
Preview updates the active view locally and may broadcast ephemeral presence if designed. Commit emits one coalesced resource operation. Cancel returns to the current projected value. Backend acceptance/rejection reconciles normally.
## Inspector takeover by Quarterback
Quarterback may temporarily present AI scope, task progress, suggestions, or generated change review in the Inspector region.
Takeover rules:
1. capture the stable selection and Inspector focus target;
2. do not clear or replace Resource selection;
3. mark the AI surface as temporary and reversible;
4. allow reveal actions to show affected subjects without silently applying operations;
5. on close/completion, restore the selection Inspector and focus;
6. Project/tab changes dispose the takeover through generation fencing;
7. AI content never calls resource stores directly; accepted actions use typed feature commands.
A permanent universal AI lens beside Details is the current implementation, not the target contract.
## Resource-specific authorities
The shared Inspector runtime defers section membership, order, and operations to:
- <mention-page url="https://app.notion.com/p/3acb6410e50281e4b8cdce47084bc8af"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281a7a32dd1c2551a7851"/>
- <mention-page url="https://app.notion.com/p/3acb6410e502815d9ba5ebc9389ecf63"/>
<mention-page url="https://app.notion.com/p/3adb6410e502816fbecde3c54898886b"/> is the current Primary authority for Document Inspector targets, section order, controls, operations, and states. The shared runtime supports it without encoding Document-specific content.
## Focus and selection behavior
- Opening Inspector from a command may move focus to its heading or first relevant control.
- Automatic selection changes update content without stealing focus from the editor.
- Closing Inspector restores the invoking control or editor host and leaves selection intact.
- Deleting the selected subject moves selection to the Resource-defined successor and announces it.
- Remote reconciliation preserves selection by stable ID/anchor where possible; otherwise it clears with an explanation.
- Inspector headings expose the accessible selection description.
- Section errors remain local unless the operation invalidates the full subject.
## Permissions and operations
The backend projection omits or marks unauthorized data/actions. The resolver checks capability descriptors to hide inapplicable actions and mark read-only controls, but Alpha does not infer permission from UI visibility. Every operation still goes through Omega authorization.
Destructive actions are last in relevant sections and use the overlay runtime for confirmation. A control cannot submit when the target revision or identity is unresolved.
## Svelte composition sketch
```javascript
<SidePanel
  region="inspector"
  open={!workspaceTab.view.inspector.collapsed}
  width={workspace.chrome.inspectorWidthPx}
  onresizepreview={inspectorResize.preview}
  onresizecommit={inspectorResize.commit}
>
  <InspectorHeader model={inspectorModel.header} />
  <InspectorSections
    sections={inspectorModel.sections}
    onintent={inspectorController.handle}
  />
</SidePanel>
```
There is no Inspector icon rail in the normal selection mode. A compact collapsed control may reopen the region; it does not represent fixed facets.
## Current Alpha migration
- replace `activeSurface.inspector` component arrays with `resolveInspector(selection)`;
- replace the permanent Details and AI section policy with adaptive sections plus temporary Quarterback takeover;
- retain Overview and Document typed selection/session/action tables as implementation seeds, then reconcile Document behavior to the current Document Inspector Primary;
- stop no-prop Inspector panels from reading global singleton session stores;
- place selection in each Resource interaction runtime and expose a stable envelope;
- move continuous controls to preview/commit/cancel;
- make Inspector open/target state per Workspace tab while keeping live selection ephemeral.
## Completion tests
Test no selection, each single-selection type, mixed compatible and incompatible selection, pending/mixed/read-only/unavailable values, selection change without focus theft, close/reopen preserving selection, continuous preview/commit/cancel, optimistic refusal, remote deletion/mapping, permission loss, AI takeover/restore, tab/Project switch, keyboard section traversal, and resolver disposal.
## Sources
- <mention-page url="https://app.notion.com/p/3adb6410e5028109af17d131af989809"/>
- <mention-page url="https://app.notion.com/p/e12b6939dbc444698aca18d4162bab10"/>
- <mention-page url="https://app.notion.com/p/393b6410e50281f4bb2ceb9db21f794b"/>
- <mention-page url="https://app.notion.com/p/3a5b6410e50281d58042cde7c2b7e516"/>
- [Current Alpha Document editor session](https://github.com/gccurtis/taurus-alpha/blob/d2b1bdcd02307f29ab4a895232cbf857d8157a56/src/lib/features/stages/document/editor/session.ts)

