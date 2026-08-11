---
title: "Model — Document Inspector"
notion_page_id: "3adb6410e502816fbecde3c54898886b"
notion_url: "https://app.notion.com/3adb6410e502816fbecde3c54898886b"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-30 06:25:58Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Model — Document Inspector

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Primary authority.** This page defines the adaptive Document Inspector: how stable Document selections resolve to ordered property and action sections. It specializes [System — Inspector & Selection Runtime](https://app.notion.com/p/3adb6410e5028189b4dcf8a6c7bda400), uses the Project-scoped Document contracts in [Ω-017 — Close the Document Project vertical slice](https://app.notion.com/p/3adb6410e50281999781e35c8dfacd05), and supplies stable reveal state to [Ω-027 — Extend Workspace history coordination](https://app.notion.com/p/3acb6410e50281e5a7b8f2ff2506c397).
## Decision
Document Inspector is one adaptive, selection-driven surface. It is not a fixed icon rail and does not have permanent Details and AI lenses.
The selected Document subject determines an ordered set of Inspector sections. Selection belongs to the Document interaction runtime; DOM focus and raw ProseMirror positions do not cross the runtime boundary. AI may temporarily take over Inspector to clarify or preview a task, but it preserves and restores the prior stable selection and focus.
The Inspector must support today's editor states and the stable Document subjects required by the Document outcome checklist. New block kinds add section providers; they do not require a new monolithic Inspector.
## Boundary
Document Inspector owns:
- the normalized stable selection envelope;
- selection precedence and resolution;
- the exact selection-kind and section-provider registries;
- draft, mixed, pending, unavailable, and read-only property states;
- translating control interaction into typed Document operations;
- temporary Quarterback takeover and restoration.
Document Inspector does not own:
- ProseMirror selection state, DOM focus, or canvas hit testing;
- canonical Document state, authorization, revisioning, or persistence;
- Context lens activation;
- Comments, References, Formula, Tasks, or History domain state;
- component-local backend calls;
- arbitrary component arrays attached to a route.
## Stable selection contract
The editor adapter normalizes implementation-specific selection into a stable envelope. Stable references use Document IDs, block/entity IDs, and revision-bound text anchors. Raw ProseMirror positions are never persisted, sent to Workspace history, or exposed to Inspector components.
```typescript
export interface DocumentSelectionEnvelope {
  projectId: ProjectId;
  documentId: DocumentId;
  atRevision: Revision;
  origin: 'editor' | 'context-reveal' | 'history-reveal' | 'task' | 'programmatic';
  selection: DocumentInspectableRef;
}

export interface StableTextPoint {
  blockId: BlockId;
  charId?: CharId;
  offsetHint: number;
  affinity: 'before' | 'after';
}

export type DocumentInspectableRef =
  | { kind: 'document'; documentId: DocumentId }
  | { kind: 'caret'; point: StableTextPoint }
  | { kind: 'text-range'; anchor: StableTextPoint; head: StableTextPoint; blockIds: BlockId[] }
  | { kind: 'new-block'; blockId: BlockId }
  | { kind: 'block'; blockId: BlockId }
  | { kind: 'blocks'; blockIds: BlockId[] }
  | { kind: 'link'; linkId: LinkId; anchor: StableTextRange }
  | { kind: 'formula'; formulaId: FormulaId; blockId: BlockId }
  | { kind: 'table-cell'; blockId: BlockId; rowId: TableRowId; columnId: TableColumnId }
  | { kind: 'table-range'; blockId: BlockId; cells: StableTableRange }
  | { kind: 'comment'; threadId: CommentThreadId; anchor?: StableDocumentTarget }
  | { kind: 'reference'; referenceId: ReferenceId }
  | { kind: 'ai-task'; taskId: AgentTaskId }
  | { kind: 'history-change'; changeSetId: ChangeSetId }
  | { kind: 'unsupported'; target: StableDocumentTarget; type: string };
```
`atRevision` makes staleness explicit. The Document runtime rebases an anchor to the current revision, retains a bounded fallback, or produces an unavailable target. A component must never guess after deletion or a failed rebase.
Rows are structural composition, not an independently inspectable subject. Row operations are offered from the selected block or multi-block state. The obsolete implementation-specific `row` selection is therefore not part of the canonical registry.
## Exact V1 selection registry
<table header-row="true">
<tr>
<td>Priority</td>
<td>Kind</td>
<td>Stable subject</td>
<td>Required behavior</td>
</tr>
<tr>
<td>1</td>
<td>`comment`</td>
<td>Comment thread and optional anchor</td>
<td>Thread details, anchor reveal, reply/resolve/reopen, provenance.</td>
</tr>
<tr>
<td>2</td>
<td>`reference`</td>
<td>Reference entity</td>
<td>Source/target/status, reveal, repair, unlink where permitted.</td>
</tr>
<tr>
<td>3</td>
<td>`ai-task`</td>
<td>Agent task</td>
<td>Inputs, status, provenance, result preview/apply/cancel/retry.</td>
</tr>
<tr>
<td>4</td>
<td>`history-change`</td>
<td>Change set</td>
<td>Actor/time/summary, affected targets, compare, reveal, undo/redo eligibility.</td>
</tr>
<tr>
<td>5</td>
<td>`block`</td>
<td>One stable block</td>
<td>Block-kind content and applicable property sections.</td>
</tr>
<tr>
<td>6</td>
<td>`blocks`</td>
<td>Ordered unique block IDs</td>
<td>Common properties, mixed values, bulk operations.</td>
</tr>
<tr>
<td>7</td>
<td>`formula`</td>
<td>Formula entity/atom</td>
<td>Expression, value/error, dependencies, usages, recalculate/edit/copy/convert.</td>
</tr>
<tr>
<td>8</td>
<td>`link`</td>
<td>Link entity and text anchor</td>
<td>Label/URL/target/status, open, edit, copy, unlink.</td>
</tr>
<tr>
<td>9</td>
<td>`table-cell`</td>
<td>Stable table cell</td>
<td>Cell content, formatting, geometry, relationships, operations.</td>
</tr>
<tr>
<td>10</td>
<td>`table-range`</td>
<td>Stable rectangular range</td>
<td>Common/mixed cell properties and bounded bulk operations.</td>
</tr>
<tr>
<td>11</td>
<td>`text-range`</td>
<td>Revision-bound stable text range</td>
<td>Selection summary, marks, semantic type, link/comment actions.</td>
</tr>
<tr>
<td>12</td>
<td>`new-block`</td>
<td>Empty stable block</td>
<td>Insert type, prompt/content choice, semantic defaults, remove/cancel.</td>
</tr>
<tr>
<td>13</td>
<td>`caret`</td>
<td>Stable text point</td>
<td>Effective typing marks and the next inserted text/block state.</td>
</tr>
<tr>
<td>14</td>
<td>`document`</td>
<td>Open Document</td>
<td>Document details and supported resource-level settings/actions.</td>
</tr>
<tr>
<td>15</td>
<td>`unsupported`</td>
<td>Known target with unknown type</td>
<td>Safe identity summary and supported navigation; no guessed controls.</td>
</tr>
</table>
Priority resolves overlapping subjects. Explicit Context or detail reveals select their entity. In the editor, an explicit whole-block selection wins over inline marks; formula/link/table targets win over a text range; a non-collapsed range wins over the caret; absence of another subject resolves to Document.
The resolver validates uniqueness, current membership, and caller visibility before producing sections. Deleted, forbidden, or stale targets become explicit unavailable states without leaking their prior details.
## Inspector runtime
```typescript
export interface DocumentInspectorController {
  readonly envelope: Readable<DocumentSelectionEnvelope>;
  readonly view: Readable<DocumentInspectorView>;

  select(ref: DocumentInspectableRef, options?: SelectOptions): Promise<void>;
  execute(command: DocumentInspectorCommand): Promise<CommandReceipt>;
  beginPreview(command: ContinuousDocumentCommand): PreviewSession;
  reveal(target: StableDocumentTarget): Promise<void>;
  beginTakeover(request: InspectorTakeover): TakeoverHandle;
  dispose(): void;
}

export interface DocumentInspectorResolver {
  resolve(
    envelope: DocumentSelectionEnvelope,
    runtime: DocumentReadProjection
  ): DocumentInspectorView;
}

export interface DocumentInspectorView {
  header: InspectorHeader;
  availability: InspectorAvailability;
  sections: DocumentInspectorSection[];
}
```
The resolver is pure over a normalized envelope and current read projection. Section bindings receive state and typed actions from the controller. They do not import the editor singleton or perform persistence.
## Exact V1 section registry
The following IDs and order are stable. A provider is omitted when it has no supported content for the selection; it is never replaced by an inert control.
<table header-row="true">
<tr>
<td>Order</td>
<td>Stable section ID</td>
<td>Responsibility</td>
</tr>
<tr>
<td>1</td>
<td>`summary`</td>
<td>Subject identity, kind, status, bounded statistics, sync/revision, and unavailable/read-only explanation.</td>
</tr>
<tr>
<td>2</td>
<td>`content`</td>
<td>Text, block-kind payload, link/formula/table/comment/reference/task/history content appropriate to the subject.</td>
</tr>
<tr>
<td>3</td>
<td>`typography`</td>
<td>Semantic text type and supported font, size, weight, line height, and inherited/default state.</td>
</tr>
<tr>
<td>4</td>
<td>`inline-style`</td>
<td>Emphasis, decoration, color, highlight, and other supported inline marks.</td>
</tr>
<tr>
<td>5</td>
<td>`layout`</td>
<td>Alignment, indentation, width, columns, table geometry, and other supported structural placement.</td>
</tr>
<tr>
<td>6</td>
<td>`spacing`</td>
<td>Before/after spacing, padding, row height, and supported density controls.</td>
</tr>
<tr>
<td>7</td>
<td>`appearance`</td>
<td>Fill, border, visual treatment, and block-kind appearance supported by the current editor.</td>
</tr>
<tr>
<td>8</td>
<td>`row-composition`</td>
<td>Actions affecting the structural row that contains selected block(s), without making Row a selection kind.</td>
</tr>
<tr>
<td>9</td>
<td>`page-flow`</td>
<td>Supported break/keep/flow rules. Omitted in the current continuous runtime when no typed operation exists.</td>
</tr>
<tr>
<td>10</td>
<td>`relationships`</td>
<td>Links, formulas/dependencies, comments, references, anchors, and usages.</td>
</tr>
<tr>
<td>11</td>
<td>`provenance`</td>
<td>Actor, task, prompt, source, revision, change set, timestamps, and generated-content provenance.</td>
</tr>
<tr>
<td>12</td>
<td>`accessibility`</td>
<td>Alternative text, labels, reading behavior, and block-kind accessibility metadata where applicable.</td>
</tr>
<tr>
<td>13</td>
<td>`actions`</td>
<td>Non-destructive navigation, copy, edit, resolve, retry, recalculate, compare, insert, and apply actions.</td>
</tr>
<tr>
<td>14</td>
<td>`danger`</td>
<td>Clearly separated destructive actions such as unlink, remove, discard, or delete, permission-gated and confirmed as required.</td>
</tr>
</table>
### Required section composition by selection
<table header-row="true">
<tr>
<td>Selection</td>
<td>Required V1 sections</td>
</tr>
<tr>
<td>`document`</td>
<td>`summary`, supported `layout`/`appearance`, `accessibility`, `actions`</td>
</tr>
<tr>
<td>`caret`</td>
<td>`summary`, `typography`, `inline-style`, `actions`</td>
</tr>
<tr>
<td>`text-range`</td>
<td>`summary`, `content`, `typography`, `inline-style`, applicable `relationships`, `actions`</td>
</tr>
<tr>
<td>`new-block`</td>
<td>`summary`, `content`, `typography`, applicable `layout`, `actions`, `danger`</td>
</tr>
<tr>
<td>`block`</td>
<td>`summary`, `content`; every applicable property/relationship/provenance/accessibility provider in registry order; `actions`; permitted `danger`</td>
</tr>
<tr>
<td>`blocks`</td>
<td>`summary`; applicable property sections with mixed-state support; `row-composition`; `actions`; permitted `danger`</td>
</tr>
<tr>
<td>`link`</td>
<td>`summary`, `content`, `relationships`, `actions`, permitted `danger`</td>
</tr>
<tr>
<td>`formula`</td>
<td>`summary`, `content`, `relationships`, `provenance`, `actions`, permitted `danger`</td>
</tr>
<tr>
<td>`table-cell` / `table-range`</td>
<td>`summary`, `content`; applicable typography/style/layout/spacing/appearance; `relationships`; `actions`; permitted `danger`</td>
</tr>
<tr>
<td>`comment`</td>
<td>`summary`, `content`, `relationships`, `provenance`, `actions`</td>
</tr>
<tr>
<td>`reference`</td>
<td>`summary`, `content`, `relationships`, `provenance`, `actions`, permitted `danger`</td>
</tr>
<tr>
<td>`ai-task`</td>
<td>`summary`, `content`, `provenance`, `actions`</td>
</tr>
<tr>
<td>`history-change`</td>
<td>`summary`, `content`, `provenance`, `actions`</td>
</tr>
<tr>
<td>`unsupported`</td>
<td>`summary`, any safe `actions`</td>
</tr>
</table>
A block-kind extension registers providers against these section IDs. It may add a new section ID only through a registry-version change with migration and accessibility review.
## Property state and editing semantics
Every editable property is explicit about availability and value:
```typescript
export type InspectorProperty<T> =
  | { state: 'same'; value: T; source: 'explicit' | 'inherited' | 'default' }
  | { state: 'mixed'; values?: T[] }
  | { state: 'unavailable'; reason: string }
  | { state: 'read-only'; value?: T; reason: string }
  | { state: 'pending'; optimistic: T; submissionId: SubmissionId };
```
- Discrete controls commit one typed operation.
- Text and numeric fields keep a local draft, validate it, then commit deliberately. Remote updates do not overwrite a dirty draft; they produce a visible conflict.
- Continuous controls begin a preview session, update a local transient projection, then commit or cancel exactly once. `Escape`, focus cancellation, resource switch, permission loss, and disposal cancel the preview.
- Multi-selection controls never invent a representative value. They show `mixed`, and a new value applies only to the compatible selected subjects.
- Inherited/default values remain distinguishable from explicit values.
## Operations and synchronization
```typescript
export interface DocumentInspectorCommand {
  projectId: ProjectId;
  documentId: DocumentId;
  expectedRevision: Revision;
  submissionId: SubmissionId;
  target: DocumentInspectableRef;
  operation: DocumentOperation;
}
```
The frontend does not send trusted caller or entitlement claims. Omega derives the caller from authentication, admits the explicit Project request, verifies the target and operation against caller-effective permission, applies revision compare-and-swap and idempotency, persists with the atomic outbox, and returns a canonical receipt.
Inspector controls call the controller. The controller:
1. validates that the target still resolves at the current revision;
2. normalizes the operation;
3. applies an explicit pending or preview projection when safe;
4. sends the typed command;
5. reconciles canonical state, revision, and events;
6. rebases or safely falls back the selection;
7. refreshes only affected section providers.
Domain operations remain capability-owned: Comments manipulate threads; References manipulate references; Formula manipulates names/formulas; Agent manipulates tasks; Workspace coordinates cross-resource undo/redo. Inspector composes their authorized view and calls their ports.
## Context, Workspace, and AI interaction
- Context remains on its user-chosen lens when Inspector selection changes.
- A Context result may explicitly reveal and select a Comment, Reference, Task, History change, Formula, Link, Table target, or block.
- Ω-027 reveal state serializes `DocumentSelectionEnvelope.selection` or a versioned stable target. It never serializes a Svelte component, ProseMirror position, or section-provider ID.
- The older Ω-027 field name `InspectorLens` is a transport-compatibility name, not evidence that Document Inspector has permanent lenses. Its Document value must resolve to a versioned Inspector target, or a later schema migration should rename it `InspectorTarget`.
- A Quarterback takeover stores the prior selection, active Context lens, editor focus target, scroll target, and open/closed state. Complete, cancel, or failure restores them when valid; otherwise it returns to the nearest surviving block or Document.
## Accessibility
- The Inspector has one labelled region and a heading that identifies the current subject.
- Section disclosures have semantic headings, deterministic order, keyboard operation, and stable focus.
- Selection changes do not move keyboard focus into Inspector automatically. Explicit reveal may focus the editor target; explicit “inspect” may focus Inspector.
- Mixed, inherited, read-only, pending, stale, conflict, and unavailable states use text and semantics, not color alone.
- Field labels, units, validation, and error association remain programmatic. Continuous controls expose value, bounds, and keyboard increments.
- `Escape` resolves the innermost active state first: control preview/draft, popover, temporary AI takeover, then Inspector close.
- Destructive controls are visually and semantically separated and use confirmation proportional to consequence.
- Screen-reader announcements cover committed changes, errors, resolved/reopened comments, task completion, and selection loss; routine caret motion is not announced.
- At 200% and 400% zoom, sections reflow without horizontal trapping or obscuring the selected subject's identity/status.
## Required tests
### Selection normalization and resolution
- Map every current editor `SelectionInfo` variant to the canonical registry.
- Prove raw ProseMirror positions and DOM references never leave the adapter.
- Test overlap precedence, duplicate/missing IDs, remote rebase, deletion, permission loss, resource close, and unsupported extension fallback.
- Every canonical selection kind resolves to an accessible view; no selection produces a blank or crashing Inspector.
### Section registry
- Assert the fourteen section IDs and order exactly.
- Assert each selection receives only applicable providers in registry order.
- Verify block-kind providers compose without importing Inspector shell or backend transport.
- Verify Row is not independently selectable and row controls are available only through eligible selected blocks.
### Editing and synchronization
- Test same/mixed/inherited/default/unavailable/read-only/pending states.
- Test validated draft commit, remote-versus-dirty conflict, continuous preview commit/cancel, duplicate submission, revision conflict, offline retry, and canonical reconciliation.
- Permission and entitlement tests prove hidden data and forbidden operations are neither displayed nor sent.
- Comments, references, formulas, tasks, and history use their capability ports.
### Workspace, takeover, and accessibility
- Ω-027 reveal/undo/redo restores a stable target, Context lens, and focus with safe fallback after deletion.
- Temporary AI takeover restores selection, focus, scroll, and open state after complete/cancel/error.
- Keyboard, screen reader, zoom, disclosure order, focus preservation, live regions, mixed values, and destructive confirmation pass automated and manual checks.
## Current-to-target migration
At Taurus Alpha `d2b1bdcd02307f29ab4a895232cbf857d8157a56`, `DetailsPanel.svelte` is a single permanent Details panel driven by the Document `EditorSession`. The runtime currently exposes `none`, `run`, `new-text`, `block`, `new-block`, `blocks`, and `row`; the panel has concrete views for `none`, `run`, `new-text`, `new-block`, and `block`.
Use this lossless adapter first:
<table header-row="true">
<tr>
<td>Current `SelectionInfo`</td>
<td>Canonical selection</td>
</tr>
<tr>
<td>`none`</td>
<td>`document`</td>
</tr>
<tr>
<td>`run`</td>
<td>`text-range`</td>
</tr>
<tr>
<td>`new-text`</td>
<td>`caret`</td>
</tr>
<tr>
<td>`new-block`</td>
<td>`new-block`</td>
</tr>
<tr>
<td>`block`</td>
<td>`block`</td>
</tr>
<tr>
<td>`blocks`</td>
<td>`blocks`</td>
</tr>
<tr>
<td>`row`</td>
<td>selected `block`/`blocks` when resolvable; otherwise `unsupported`</td>
</tr>
</table>
Then:
1. Keep the pure selection derivation in the Document model, but make the ProseMirror adapter emit stable references and an explicit revision.
2. Replace route-provided `activeSurface.inspector` arrays and monolithic `DetailsPanel` dispatch with the resolver and section registry.
3. Extract the existing None, Selected Text, Next Text, New Block, and Block views into initial providers without changing their working controls.
4. Inject a per-resource `DocumentInspectorController`; remove component access to singleton session state and direct transport.
5. Add stable Link, Formula, Table, Comment, Reference, AI Task, and History selections as their backend/resource contracts land through Ω-017.
6. Remove `row` as a public selection kind. Preserve supported row-height/column/structural operations under `row-composition` for selected blocks.
7. Replace any permanent AI Inspector view with temporary Quarterback takeover and restoration.
8. Supply versioned stable reveal targets for Ω-027. Persist reveal targets, not provider/component identity.
The current continuous editor, removed gutter/block-manipulation chrome, and lack of pagination are deliberate present constraints. This model does not reintroduce them. A provider appears only when a typed read model and operation exist.
## Acceptance
Document Inspector is complete when:
- all fifteen canonical selection kinds resolve deterministically and the fourteen section IDs order every provider;
- stable selection targets cross editor, Context reveal, Workspace history, and backend boundaries without raw editor/DOM identity;
- today's working Details controls survive as providers, while required Link, Formula, Table, Comment, Reference, Task, and History states have typed contracts;
- property controls implement mixed/inherited/draft/preview/pending/conflict semantics;
- every persisted action is Project-scoped, revisioned, idempotent, caller-authorized, and reconciled with canonical state;
- selection change never steals Context activation or keyboard focus;
- AI takeover and Ω-027 restoration are lossless or use an explicit safe fallback;
- permission, extension, lifecycle, synchronization, and accessibility tests pass.
## Sources
- [System — Inspector & Selection Runtime](https://app.notion.com/p/3adb6410e5028189b4dcf8a6c7bda400)
- [System — Context Rail & Lens Runtime](https://app.notion.com/p/3adb6410e5028109af17d131af989809)
- [Ω-017 — Close the Document Project vertical slice](https://app.notion.com/p/3adb6410e50281999781e35c8dfacd05)
- [Ω-027 — Extend Workspace history coordination](https://app.notion.com/p/3acb6410e50281e5a7b8f2ff2506c397)
- [Document outcome checklist](https://app.notion.com/p/3a5b6410e50281d58042cde7c2b7e516)
- [Current Document editor session](https://github.com/gccurtis/taurus-alpha/blob/d2b1bdcd02307f29ab4a895232cbf857d8157a56/src/lib/features/stages/document/editor/session.ts)
- [Current Document Details panel](https://github.com/gccurtis/taurus-alpha/blob/d2b1bdcd02307f29ab4a895232cbf857d8157a56/src/lib/features/stages/document/panels/DetailsPanel.svelte)

