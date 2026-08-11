---
title: "Interface - Chat Editor Inspector Panel Lenses"
notion_page_id: "3acb6410e502815d9ba5ebc9389ecf63"
notion_url: "https://app.notion.com/3acb6410e502815d9ba5ebc9389ecf63"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 01:32:57Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Interface - Chat Editor Inspector Panel Lenses

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

<callout icon="🔎" color="blue_bg">
	**Implementation-facing Taurus Yesod specification.** This page defines every meaningful Chat editor selection and the adaptive inspector lens shown for it. The inspector answers **“What can I change about this selection?”** and remains independent of any current editor implementation.
</callout>
# Decision
The Chat inspector is one adaptive right-side lens. It does not maintain a user-chosen registry like the context panel. Its content is resolved from the active Chat selection, an explicit detail mode, or AI Quarterback focus.
This page is both:
1. the canonical selection taxonomy for the Chat editor; and
2. the implementation contract for the header, fields, actions, states, and operation boundary of every selection lens.
Context answers **what exists around the chat**. Inspector answers **what is true of, and editable about, the selected target**. AI Quarterback focus temporarily owns the inspector for mode, scope, persona, verification, result target, and response history; that shared AI lens is not duplicated here.
# Inspector shell
```plain text
┌────────────────────────────────────────────┐
│ [icon] SELECTION LABEL            [⋯] [×] │
│ breadcrumb / stable identity / live status │
├────────────────────────────────────────────┤
│ primary fields and selection-specific state│
│────────────────────────────────────────────│
│ grouped controls; progressive disclosure   │
│ validation / provenance / derived status   │
│────────────────────────────────────────────│
│ secondary actions                          │
│ destructive actions, separated and last    │
└────────────────────────────────────────────┘
```
- Preferred content width is 300px, with a 240px minimum and 420px maximum.
- The header always names the selected kind. It adds a human-readable breadcrumb and exposes stable IDs through copy/details, not as visual noise.
- The panel is one continuous surface with compact labelled rows, restrained dividers, and disclosure groups. It does not turn every property group into a floating card.
- Celestial and Night change chromatic tokens only. Geometry, hierarchy, motion, focus behavior, and information density remain invariant.
- Controls appear only when meaningful for the selection and permitted for the actor.
- Destructive actions are visually separated, require consequences to be named, and never occupy the primary action position.
- Closing the inspector clears or collapses the panel, not the editor selection. Escape leaves a nested detail mode first, then clears the selection according to the editor’s normal selection rules.
# Selection resolution
The selection path is ephemeral workspace state. It is not persisted in the Chat aggregate:
```typescript
type ChatInspectorSelection =
  | { kind: 'none' }
  | { kind: 'chat'; chatId: ChatID }
  | { kind: 'turn'; chatId: ChatID; turnId: TurnID }
  | { kind: 'prompt'; chatId: ChatID; turnId: TurnID }
  | { kind: 'prompt-range'; chatId: ChatID; turnId: TurnID; range: TextRange }
  | { kind: 'response'; chatId: ChatID; turnId: TurnID }
  | { kind: 'response-range'; chatId: ChatID; turnId: TurnID; range: TextRange }
  | { kind: 'citation'; chatId: ChatID; turnId: TurnID; citationId: CitationID }
  | { kind: 'evidence-ref'; chatId: ChatID; turnId: TurnID; evidenceId: EvidenceID }
  | { kind: 'attachment'; chatId: ChatID; turnId: TurnID; fileId: FileID }
  | { kind: 'context-ref'; chatId: ChatID; turnId: TurnID; contextKey: ContextKey }
  | { kind: 'persona-snapshot'; chatId: ChatID; turnId: TurnID }
  | { kind: 'agent-task'; chatId: ChatID; turnId: TurnID; taskId: TaskID };
```
Resolution always includes project scope and resolved Chat revision. Turn, block, run, atom, citation, attachment, and referenced-resource identities are stable IDs or stable keys. Display ordinals and excerpts are projections, never mutation identity.
If a selection target disappears after an accepted revision, the inspector displays **Selection no longer exists**, preserves a safe copyable breadcrumb when possible, and offers to clear or navigate to the nearest surviving parent. It never silently retargets another Turn.
# Selection taxonomy
<table header-row="true">
<tr>
<td>Stable kind</td>
<td>Header icon</td>
<td>How selected</td>
<td>Inspector responsibility</td>
</tr>
<tr>
<td>`none`</td>
<td>`MousePointer2`</td>
<td>No active Chat target</td>
<td>Explain what may be selected; show no editable settings.</td>
</tr>
<tr>
<td>`chat`</td>
<td>`MessageSquare`</td>
<td>Chat title/header or explicit Chat details action</td>
<td>Chat identity, defaults, pinned resource, lifecycle, and health.</td>
</tr>
<tr>
<td>`turn`</td>
<td>`GitBranch`</td>
<td>Turn chrome, timestamp, branch node, or thread result</td>
<td>Topology, immutable snapshot metadata, retry/fork/redaction actions.</td>
</tr>
<tr>
<td>`prompt`</td>
<td>`Send`</td>
<td>User-prompt body or Prompt details action</td>
<td>Prompt content, attachments, context, web flag, author, and edit eligibility.</td>
</tr>
<tr>
<td>`prompt-range`</td>
<td>`TextSelect`</td>
<td>Text selection inside a Prompt</td>
<td>Exact anchored range, replacement/redaction, copy, and save-as-prompt routes.</td>
</tr>
<tr>
<td>`response`</td>
<td>`Sparkles`</td>
<td>Response body, status, or Response details action</td>
<td>Lifecycle, result content, generation provenance, usage, retry/cancel/edit actions.</td>
</tr>
<tr>
<td>`response-range`</td>
<td>`TextSelect`</td>
<td>Text selection inside a Response</td>
<td>Anchored text, citation coverage, replacement, and evidence routes.</td>
</tr>
<tr>
<td>`citation`</td>
<td>`Quote`</td>
<td>Inline citation marker or Evidence lens result</td>
<td>Supported response range, source snapshot, label, and source navigation.</td>
</tr>
<tr>
<td>`evidence-ref`</td>
<td>`BookOpenCheck`</td>
<td>Evidence item associated with a Response</td>
<td>Evidence identity, provenance, access, and accepted-result relationship.</td>
</tr>
<tr>
<td>`attachment`</td>
<td>`Paperclip`</td>
<td>Prompt attachment chip</td>
<td>File metadata and Prompt association; never File lifecycle ownership.</td>
</tr>
<tr>
<td>`context-ref`</td>
<td>`LibraryBig`</td>
<td>Prompt context chip or Context lens result</td>
<td>Resource/revision/selector snapshot and Prompt inclusion.</td>
</tr>
<tr>
<td>`persona-snapshot`</td>
<td>`UserRound`</td>
<td>Turn persona badge</td>
<td>Immutable persona used by the Turn and routes for future-turn defaults.</td>
</tr>
<tr>
<td>`agent-task`</td>
<td>`ListTodo`</td>
<td>Response task badge or AI Tasks result</td>
<td>Agent-owned execution, approval, logs, side effects, and Chat linkage.</td>
</tr>
</table>
Multi-Turn, multi-citation, and mixed-kind selection are excluded from v1. Transcript range selection never implicitly becomes a cross-Turn bulk-edit command.
# Selection lens specifications
## Nothing selected
**Stable kind:** `none`  
**Icon:** `MousePointer2`
```plain text
Nothing selected
Select a prompt, response, citation, attachment,
context reference, persona, task, or turn details.
```
The empty state is calm and instructional. It shows no Chat settings and no disabled field wall. A single **Inspect Chat** route may select the Chat resource explicitly.
## Chat lens
**Stable kind:** `chat`  
**Icon:** `MessageSquare`
### Composition
```plain text
Chat
[Title                                      ]
Revision · updated · creator · lifecycle
Defaults
  Mode        Ask / Plan / Action
  Persona     [persona]
Pinned resource
  [resource or None]
Active path
  leaf turn · branch count · response health
```
### Displays
- Chat title, stable ID on demand, project, creator, timestamps, revision, base sequence, lifecycle, and sync state.
- Default mode and default persona used only for new Turns.
- Optional pinned resource and its access/health state.
- Active leaf Turn, root-to-leaf length, fork count, hidden subtree count, and pending/running/error Response counts.
### Controls and actions
- Rename through `rename_chat`.
- Set default mode, default persona, and pinned resource through `set_default_mode`, `set_default_persona`, and `set_pinned_resource`.
- Navigate to the active leaf, copy the Chat link, or open full history.
- Lifecycle actions appear last and use the owning Resource lifecycle boundary.
### Behavior
Changing defaults never reinterprets historical Turns. A missing pinned resource remains named by stable reference and is labelled inaccessible or deleted; it is not silently cleared.
## Turn lens
**Stable kind:** `turn`  
**Icon:** `GitBranch`
### Composition
```plain text
Turn · path position
Ask / Plan / Action · persona snapshot
Parent [turn] · children N · active path yes/no
Prompt submitted · response status
[Make active] [Fork from here] [Retry]
────────
Redact turn
Hide subtree
```
### Displays
- TurnID, current path position, parent, ordered children, rank, active-path state, timestamps, mode, persona snapshot, Prompt author, and Response state.
- Whether the Turn has descendants and therefore whether its Prompt may be edited in place.
- Task linkage for Plan/Action, citation/evidence counts, response usage, diagnostics, and hidden/redacted state.
### Controls and actions
- `set_active_leaf` makes this Turn or a descendant leaf the visible path.
- **Fork from here** appends a new Turn with this Turn as parent. It never manufactures a Branch entity.
- **Retry** creates a new generation attempt under the explicit retry/fork policy; the prior accepted response remains auditable.
- `redact_turn` replaces sensitive display content with a tombstone while preserving topology/audit identity.
- `hide_subtree` is separated and reports the descendant count. A Turn with descendants is never deleted.
### Behavior
Topology is read from stable parent pointers. An ordinal or visual branch lane is never sent as identity. Undoing a Turn mutation cannot reverse external side effects performed by an Agent task.
## Prompt lens
**Stable kind:** `prompt`  
**Icon:** `Send`
### Composition
```plain text
Prompt · Turn path position
Author · submitted time
Mode · persona snapshot · Include web
Content preview / word count
Attachments (N)
Context snapshots (N)
[Edit] [Save as reusable prompt] [Fork and edit]
```
### Displays
- Authored RichContent, plain-text projection, author, submission time, selected mode/persona, web flag, attachment list, and context snapshots.
- Edit eligibility: editable leaf with no descendants; fork required; redacted; read-only; or response already derived.
- Source Prompt asset/version attribution when one was loaded before submission.
### Controls and actions
- Eligible direct edits use `replace_prompt` or bounded `splice_prompt_text`.
- Attachment and context changes use `set_prompt_attachments` and `set_prompt_context`.
- If descendants or a derived response make in-place edit unsafe, the primary action becomes **Fork and edit**.
- **Save as reusable prompt** calls the Prompt Library boundary and never changes this historical Prompt.
### Behavior
Editing a Prompt invalidates or replaces derived response work through one validated transaction/policy. A source Prompt Library update never overwrites historical content. Rich-text formatting controls stay hidden until Chat defines corresponding typed mark/style operations.
## Prompt text-range lens
**Stable kind:** `prompt-range`  
**Icon:** `TextSelect`
### Displays
- Selected text, character/word counts, TextRange anchors, containing block/run/atom, attachment/context adjacency, and edit eligibility.
### Controls and actions
- Copy, replace, delete, or redact the anchored text using bounded `splice_prompt_text`.
- Save selected text as a new reusable Prompt draft.
- Fork and replace when the historical Prompt cannot be edited in place.
### Behavior
Offsets are UTF-8 byte offsets on rune boundaries and transform only when safety is proven. The inspector never exposes raw offsets as primary UI. Cross-atom or cross-block edits expand into ordered typed operations.
## Response lens
**Stable kind:** `response`  
**Icon:** `Sparkles`
### Composition
```plain text
Response · complete / running / error / cancelled
Accepted content remains visible
Task / citations / evidence / usage
Generation
  token · source revision · display revision
  started · completed · diagnostic
[Retry] [Cancel] [Compare] [Edit response]
```
### Displays
- Durable status, accepted/last-good RichContent, task ID, citations, evidence, usage, timestamps, diagnostic, generation token, source revision, and display revision.
- Ephemeral streaming state is labelled live and never presented as canonical history.
- Stale, failed, cancelled, pending, and running states retain the last accepted display when one exists.
### Controls and actions
- Running work may request `cancel_response`; the UI remains pending until cancellation is accepted.
- Retry begins a tokenized generation attempt without clearing accepted content.
- Human edits use `replace_response` or `splice_response_text` and advance display revision.
- Citation/evidence set changes use `set_response_citations` and `set_response_evidence`.
- Open linked Agent task or evidence; copy/export response.
### Behavior
A completion is accepted only when generation token, source revision, display revision, and parent path still match. Late output is shown as stale or discarded according to policy and never overwrites newer work.
## Response text-range lens
**Stable kind:** `response-range`  
**Icon:** `TextSelect`
### Displays
- Selected response text, stable anchors, citation coverage, evidence links, atom kind, generated/human-edited status, and edit permission.
### Controls and actions
- Copy, replace, delete, or redact through bounded `splice_response_text`.
- Add, edit, or remove citation coverage through an atomic citation-set operation.
- Open supporting sources or create a new Prompt draft from the selection.
### Behavior
Text edits and affected citation-anchor transforms occur in the same ChangeSet. An edit may not leave silently dangling citation offsets.
## Citation lens
**Stable kind:** `citation`  
**Icon:** `Quote`
### Displays
- Citation ID, label, supported Response excerpt/range, source ResourceID/kind/revision/selector, resolution status, and access state.
- Whether the source is current, historical, moved, inaccessible, or deleted.
### Controls and actions
- Open the exact source snapshot/selector, copy citation, edit label/source/target, or remove citation.
- Citation mutations submit the complete validated citation set through `set_response_citations`.
### Behavior
The source snapshot does not float to the latest resource revision. A user may explicitly update it after reviewing the new source. Missing access never exposes protected content.
## Evidence-reference lens
**Stable kind:** `evidence-ref`  
**Icon:** `BookOpenCheck`
### Displays
Evidence identity, type, accepted-result relationship, source snapshot, excerpt/summary permitted by access, verification state, and any citation coverage.
### Controls and actions
Open source, open Evidence details, attach/detach from the Response through `set_response_evidence`, or create citation coverage for an eligible anchored range.
### Boundary
Evidence owns evidence records and verification. Chat stores accepted references only.
## Attachment lens
**Stable kind:** `attachment`  
**Icon:** `Paperclip`
### Displays
FileID, name, media type, size/status when authorized, uploader, Prompt association, and whether the engine could read it.
### Controls and actions
Open/download through File, remove from this Prompt through `set_prompt_attachments`, replace the Prompt association, or inspect parse/ingestion status.
### Boundary
Removing an attachment from a Prompt does not delete the File. File lifecycle and protected bytes remain File-owned.
## Context-reference lens
**Stable kind:** `context-ref`  
**Icon:** `LibraryBig`
### Displays
ResourceID, kind, captured revision, selector, human label, access state, resolver status, and a permitted preview of the selected fragment.
### Controls and actions
Open the exact resource selection, replace/remove the Prompt context reference, or explicitly update to another reviewed revision.
### Boundary
Chat stores the request snapshot. The owning capability resolves content; the inspector does not copy or edit foreign resource state.
## Persona-snapshot lens
**Stable kind:** `persona-snapshot`  
**Icon:** `UserRound`
### Displays
Persona identity/version/hash, display name, relevant behavioral summary, source availability, Turn mode, and immutable-snapshot status.
### Controls and actions
Open the Persona, set it as the Chat default for future Turns, or fork a new Turn using another persona.
### Behavior
Historical Turns retain the persona snapshot they used. Changing the Chat default or source Persona never rewrites them.
## Agent-task lens
**Stable kind:** `agent-task`  
**Icon:** `ListTodo`
### Displays
Agent-owned task status, plan/execution mode, approval state, requested and completed actions, logs, outputs, errors, timestamps, and external side-effect summary.
### Controls and actions
Open task, approve/reject when authorized, cancel when supported, inspect output, or start a compensating task.
### Boundary
Chat stores TaskID and concise durable linkage. Agent owns execution and approval truth. Chat undo, response hiding, or redaction never reverses external work.
# Detail-mode registry
```typescript
import {
  MousePointer2, MessageSquare, GitBranch, Send, TextSelect, Sparkles,
  Quote, BookOpenCheck, Paperclip, LibraryBig, UserRound, ListTodo
} from '@lucide/svelte';

export const chatInspectorResolvers: InspectorResolverMap<ChatInspectorSelection> = {
  none:              { icon: MousePointer2, component: NothingSelectedPanel },
  chat:              { icon: MessageSquare, component: ChatDetailsPanel },
  turn:              { icon: GitBranch, component: TurnDetailsPanel },
  prompt:            { icon: Send, component: PromptDetailsPanel },
  'prompt-range':    { icon: TextSelect, component: PromptRangePanel },
  response:          { icon: Sparkles, component: ResponseDetailsPanel },
  'response-range':  { icon: TextSelect, component: ResponseRangePanel },
  citation:          { icon: Quote, component: CitationDetailsPanel },
  'evidence-ref':    { icon: BookOpenCheck, component: EvidenceRefPanel },
  attachment:        { icon: Paperclip, component: AttachmentDetailsPanel },
  'context-ref':     { icon: LibraryBig, component: ContextRefPanel },
  'persona-snapshot':{ icon: UserRound, component: PersonaSnapshotPanel },
  'agent-task':      { icon: ListTodo, component: AgentTaskPanel }
};
```
# Edit and concurrency contract
Every canonical Chat mutation submits:
```typescript
interface InspectorCommand<T> {
  projectId: ProjectID;
  chatId: ChatID;
  expectedRevision: number;
  submissionId: string;
  actor: ActorRef;
  selection: ChatInspectorSelection;
  operation: T;
}
```
- Local field drafts do not mutate the aggregate. Enter or an explicit Apply commits; Escape restores the accepted value. Blur may commit only for fields whose validation and consequence are unambiguous.
- The inspector updates optimistically only when it can reconcile the accepted revision or restore the prior projection on rejection.
- On stale revision, re-resolve the selection and preserve the user draft. Retry automatically only when the capability proves the operation safe.
- Read-only, locked, redacted, inaccessible, pending, stale, and failed states are explicit. A disabled control explains why.
- Destructive actions preview affected Turn/subtree counts and remain last.
# Cross-capability boundaries
- Prompt Library owns reusable Prompt assets and versions.
- File owns attachments and protected bytes.
- Resource capabilities own context snapshots and selectors.
- Persona owns persona definitions; Chat stores historical snapshots.
- Evidence owns evidence records and verification.
- Agent owns tasks, approvals, execution logs, and external side effects.
- Activity/Search/Annotation may project Chat changes but do not become mutation authorities.
# Required model alignment
- Chat has typed Prompt and Response text-splice operations but no typed mark/style operations. Do not expose rich-text formatting controls until those operations and validation contracts exist.
- A reusable Prompt asset is not a Chat Turn. Save/load routes through the Prompt Library.
- Task, persona, evidence, file, and resource detail panels require read adapters that preserve project scope and never infer missing access.
- Selection projections need stable TextRange/anchor transformation and explicit orphan states.
# Accessibility and keyboard contract
- Inspector headers and groups use semantic headings; every control has a programmatic label and described validation/status.
- Selection changes announce kind and label without re-announcing the whole panel.
- Tab order follows visible order. Hidden disclosure content is not focusable.
- Escape exits nested detail mode before clearing selection. Enter applies a focused eligible field; destructive confirmation never shares that shortcut.
- Status is never color-only. Running, stale, error, read-only, redacted, inaccessible, and orphaned states include text/icon treatment.
- Copy-ID actions expose full stable identity without forcing it into the default visual hierarchy.
# Acceptance checklist
- [ ] Every selectable Chat entity resolves to exactly one stable selection kind and inspector component.
- [ ] The empty state shows no unrelated settings.
- [ ] Turn topology uses stable IDs, never branch lanes or ordinals as mutation identity.
- [ ] Prompt edits enforce descendant/derived-response constraints or fork explicitly.
- [ ] Response generation preserves accepted content and rejects stale tokens.
- [ ] Citation anchors transform atomically with response text edits.
- [ ] File, Resource, Persona, Evidence, Prompt Library, and Agent authority boundaries are visible and enforced.
- [ ] Historical persona and context snapshots never float silently.
- [ ] Read-only, stale, pending, failed, inaccessible, redacted, and orphaned states are honest.
- [ ] Destructive actions are separated, last, and consequence-labelled.
- [ ] No Chat lens becomes a generic settings bin.
- [ ] Keyboard and screen-reader behavior is complete.
- [ ] All code examples and command mappings match the Chat runtime contract.
# Sources
- <mention-page url="https://app.notion.com/p/3abb6410e50281258d89d5719fa851fc"/>
- <mention-page url="https://app.notion.com/p/3acb6410e5028173a1d0c6266bbe87c9"/>
- <mention-page url="https://app.notion.com/p/e12b6939dbc444698aca18d4162bab10"/>
- <mention-page url="https://app.notion.com/p/39ab6410e50281798739fa3a9e8931ac"/>

