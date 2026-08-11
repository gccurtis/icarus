---
title: "Architecture — Interaction, Intent & Operation Pipeline"
notion_page_id: "3adb6410e50281d887f1f53fcc2b5575"
notion_url: "https://app.notion.com/3adb6410e50281d887f1f53fcc2b5575"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 05:31:05Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Architecture — Interaction, Intent & Operation Pipeline

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Decision:** Components emit semantic interaction events. Feature controllers turn those events into typed frontend intents and invoke explicit runtime commands. Only system clients encode transport operations. Taurus Alpha does not use a universal application event bus.
## Why this boundary exists
A click, keystroke, drag, selection, or form submission is not automatically a backend operation. The interaction runtime decides whether it is:
- presentation-only;
- a transient workflow step;
- durable personal Workspace state;
- a control-plane command;
- a Project capability mutation;
- an AI command or job request.
That classification keeps components focused on semantics and accessibility while runtimes manage coordination and models interact through typed functions.
## Pipeline
```plain text
DOM/input event
  → component semantic event
    → feature controller
      → typed frontend intent
        → runtime command
          → operation compiler
            → system client
              → Omega
                → canonical result/event
                  → replica reconciliation
                    → view model
                      → component props
```
The return path is as important as submission. A component never assumes that emitting `rename` means a resource is renamed. It renders the optimistic state and explicit pending/refused/conflict status supplied by the runtime.
## Five intent classes
<table header-row="true">
<tr>
<td>Class</td>
<td>Examples</td>
<td>Durable owner</td>
</tr>
<tr>
<td>Presentation intent</td>
<td>open tooltip, expand accordion, hover object</td>
<td>none; component/view</td>
</tr>
<tr>
<td>Interaction workflow</td>
<td>edit form draft, choose menu item, start drag, compose prompt</td>
<td>interaction controller</td>
</tr>
<tr>
<td>Workspace intent</td>
<td>open/move/close/activate tab; choose Context lens; set panel width; set viewport</td>
<td>user×Project Workspace</td>
</tr>
<tr>
<td>Control-plane command</td>
<td>rename account, manage organization member, change Project grant, materialize user asset into Project</td>
<td>control plane</td>
</tr>
<tr>
<td>Project capability operation</td>
<td>edit Document, set Spreadsheet cell, update Slide object, append Chat turn, create Project Agent task</td>
<td>Project capability/Omega</td>
</tr>
</table>
The same physical control can produce different classes. Selecting a Context icon is a Workspace command; selecting a paragraph is usually ephemeral editor state; editing that paragraph is a Document operation.
## Contracts
```typescript
type FrontendIntent =
  | { type: "workspace.activate-tab"; tabId: string }
  | { type: "workspace.select-context-lens"; tabId: string; lensId: string }
  | { type: "resource.rename"; resourceId: string; draftName: string }
  | { type: "document.apply-edit"; resourceId: string; edit: DocumentEdit }
  | { type: "project.materialize-library-asset"; assetId: string; targetProjectId: string }
  | { type: "ai.submit"; draftId: string; scope: AIScope };

interface FeatureController<I, S> {
  readonly state: Readable<S>;
  handle(intent: I): Promise<InteractionOutcome>;
}

type InteractionOutcome =
  | { kind: "accepted-locally"; submissionId?: string }
  | { kind: "completed"; message?: string }
  | { kind: "needs-confirmation"; confirmation: ConfirmationModel }
  | { kind: "refused"; fault: FrontendFault }
  | { kind: "canceled" };

interface OperationCompiler<I, Op> {
  compile(intent: I, context: CompileContext): Op | CompileRefusal;
}
```
A component accepts state plus callbacks:
```javascript
<ResourceNameField
  value={model.name}
  pending={model.renamePending}
  invalid={draftError}
  oninput={(value) => controller.handle({
    type: "resource-name.edit-draft",
    value
  })}
  oncommit={() => controller.handle({
    type: "resource.rename",
    resourceId: model.id,
    draftName
  })}
/>
```
The component knows neither the endpoint nor the revision.
## Interaction controllers
A feature controller may own:
- local draft fields and validation presentation;
- multi-step workflow state;
- semantic selection transitions;
- confirmation requests;
- reveal/focus instructions;
- calls to one or more narrow runtime commands;
- mapping typed failures to component-facing view models.
It may not own a second copy of confirmed domain data. It subscribes to the runtime projection or receives it from composition.
Controllers are feature-scoped. There is no global `dispatch(anyEvent)`. Cross-feature coordination uses explicit services such as Workspace commands, selection models, overlay requests, navigation, unified history, and AI scope—not event name conventions.
## Draft versus operation
Form fields use a three-stage model:
1. **confirmed value** from Omega;
2. **editable draft** owned by the interaction controller;
3. **pending operation** owned by the replica controller after commit.
Typing does not mutate confirmed state. Blur is not universally commit; each field declares commit semantics. Cancel restores the confirmed value unless product policy preserves a draft. Validation can run locally for responsiveness, but Omega remains authoritative.
High-frequency state is split deliberately:
- pointer movement, live resizing, hover, IME composition: view-local;
- viewport/scroll/zoom: debounced Workspace view-state command;
- structural tab changes: immediate Workspace command;
- resource edits: resource-specific typed operations;
- presence/live selection: ephemeral collaboration transport.
## Selection and editors
Selection is a first-class frontend interaction model because it drives the Inspector, commands, keyboard routing, and AI scope. It is not automatically durable.
The editor integration may combine interaction and rendering more tightly than a normal component:
- ProseMirror owns its editor state and transactions;
- the Document adapter translates eligible transactions to Document edits;
- the selection adapter exports a stable frontend `SelectionEnvelope`;
- the Inspector resolver maps that selection to controls;
- the view applies runtime reconciliation without becoming canonical authority.
This exception is local to the Resource adapter. It does not justify components calling stores or clients directly elsewhere.
## Drag and direct manipulation
Direct manipulation has three phases:
- **candidate:** pointer/keyboard interaction and preview, no mutation;
- **commit intent:** stable source/target IDs and semantic action;
- **operation:** Workspace or resource command.
Every drag action has a non-drag alternative. Reorderable controls expose move commands through keyboard/menu interaction. Failed commits restore the prior confirmed/optimistic model without leaving the DOM and runtime divergent.
## Confirmations and destructive actions
Controllers request confirmation from the overlay runtime with a typed model. The modal returns a result; it does not perform the domain mutation itself.
```typescript
const confirmed = await overlays.confirm({
  title: "Delete resource?",
  description: "This removes the resource for everyone with Project access.",
  confirmLabel: "Delete",
  tone: "danger",
  returnFocusTo: trigger
});

if (confirmed) {
  await resources.delete({ projectId, resourceId });
}
```
This makes focus, cancellation, and destructive semantics reusable without coupling the component library to capabilities.
## Effects
Runtime commands may return declarative effects:
- reveal a resource or selection;
- navigate to an explicit route;
- open/close an overlay;
- announce a status;
- focus a target;
- show a toast;
- hand an operation to unified undo.
Effects are interpreted by application services. They do not travel through a universal event stream, and they cannot silently grant access or rewrite another runtime’s state.
## Fault model
All controllers map a small typed fault family:
- authentication expired;
- admission/authorization refused;
- entitlement unavailable;
- validation failed;
- revision conflict;
- resource missing;
- connectivity unavailable;
- rate limited;
- server unavailable;
- client/runtime invariant violated;
- unsupported version or resource kind.
Components render fault models; they do not parse HTTP status codes.
## Verification
Tests exist at four boundaries:
- component tests assert semantics, keyboard behavior, and emitted events;
- controller tests assert intent classification and runtime calls;
- compiler tests assert stable IDs, scope, revisions, and typed operation encoding;
- integration tests assert optimistic state, backend result reconciliation, focus/effects, and refusal recovery.
## Sources
- <mention-page url="https://app.notion.com/p/3adb6410e50281ff9601e70217f36c96"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502815497b0e1c1c60ef284"/>
- <mention-page url="https://app.notion.com/p/3acb6410e502812bb4e0ff2c91ff753f"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281ddaa6dca8f6e1802fb"/>
- [Svelte runes](https://svelte.dev/docs/svelte/what-are-runes)
- [Svelte stores](https://svelte.dev/docs/svelte/stores)
- [ProseMirror guide](https://prosemirror.net/docs/guide/)

