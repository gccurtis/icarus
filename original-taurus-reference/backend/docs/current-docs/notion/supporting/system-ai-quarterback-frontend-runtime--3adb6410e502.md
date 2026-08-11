---
title: "System — AI Quarterback Frontend Runtime"
notion_page_id: "3adb6410e50281d7a7a9ef751b661ff4"
notion_url: "https://app.notion.com/3adb6410e50281d7a7a9ef751b661ff4"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 05:31:05Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# System — AI Quarterback Frontend Runtime

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Decision:** Quarterback is the frontend coordination surface for AI work. It composes explicit Project/resource/selection context, submits typed AI requests or tasks, presents transient streaming progress separately from durable turns and task effects, and routes accepted plans through the same typed capability operations used by direct manipulation. It never writes canonical resources directly.
## Product surfaces
AI has four related but distinct frontend surfaces:
- **Quarterback dock:** persistent bottom composer/status bar in the Project workbench;
- **AI Inspector takeover:** expanded conversation, task progress, suggestions, proposed changes, and context review in the right region;
- **Project Agents surface:** durable Project Agent/task definitions, runs, schedules, and status inside the admitted Project;
- **user Personality/Agents library:** user-level Personalities and cross-Project monitor outside any selected Project.
The user library can be browsed without Project admission. Starting Project work names a Project and passes fresh admission.
## Runtime responsibilities
The Project AI runtime owns:
- prompt drafts and selected Personality/Agent;
- explicit AI scope;
- attached Context/resource/selection references;
- conversation/turn projection where durable;
- streaming response state;
- task/job projection and progress;
- cancellation/retry;
- proposed actions/change sets;
- takeover/reveal coordination;
- entitlement and capability presentation;
- disposal when the owning frontend Project runtime is released or the user signs out.
Ordinary Workspace-tab changes do not dispose Project AI state or cancel submitted tasks. They may rebase the default scope of an unsubmitted draft and detach a tab-bound Inspector takeover or reveal attachment.
It does not own Document/Spreadsheet/Slides/Chat state or bypass their controllers.
## Scope model
```typescript
interface AIScope {
  projectId: string;
  resourceRefs: readonly AIResourceRef[];
  selection?: StableInspectableTarget;
  contextRefs: readonly AIContextRef[];
  personalityId?: string;
  conversationId?: string;
}

interface EphemeralAIContextItem {
  label: string;
  text: string;
  source: "user" | "active-surface";
}

interface AIDraft {
  id: string;
  text: string;
  scope: AIScope;
  ephemeralContextItems: readonly EphemeralAIContextItem[];
  attachments: readonly AIAttachmentDraft[];
  state: "editing" | "submitting" | "submitted" | "failed";
}

interface PlanAcceptance {
  taskId: string;
  expectedTaskRevision: number;
  submissionId: string;
}

interface AIProjectRuntime {
  readonly state: Readable<AIProjectState>;
  updateDraft(change: AIDraftChange): void;
  submit(draftId: string): Promise<AIOutcome>;
  cancel(runId: string): Promise<void>;
  retry(runId: string): Promise<void>;
  acceptPlan(command: PlanAcceptance): Promise<ActionOutcome>;
  dispose(): void;
}
```
Scope references use stable IDs and backend-authorized handles. `activeTabId` is local Workspace/view state and never crosses the AI domain boundary as authority; the controller translates the active view into stable Resource and selection references. The frontend does not paste hidden Resource data into requests merely because it is locally cached. The backend reauthorizes every reference.
## Submission pipeline
1. User composes a draft in Quarterback.
2. Runtime translates active-tab/view hints into explicit stable Resource and selection references.
3. User reviews references, attachments, and any bounded ephemeral context items.
4. Controller validates the draft, canonical Ask/Plan/Action mode, capability, entitlement presentation, and limits.
5. It submits an AI request with ProjectID, stable references, conversation identity, and one durable idempotency identity.
6. Omega reauthorizes every reference, snapshots the selected Personality/version when applicable, and starts the Agent/Chat task or turn.
7. Alpha presents transient stream chunks as partial state while reconciling durable turn/task projections through Ω-014 descriptors and endpoint reads.
8. Tool effects and change summaries are server-authored task/run effects with evidence and typed target identities.
9. V1 Plan acceptance calls the Ω-019 accept-plan contract. Any direct capability transaction uses that capability’s explicit typed endpoint and per-target revision preconditions.
10. Resource replicas reconcile the resulting accepted canonical operations.
Generated text, a stream chunk, or a frontend preview is not proof that an operation occurred.
## Conversation, task, and draft state
<table header-row="true">
<tr>
<td>State</td>
<td>Owner</td>
</tr>
<tr>
<td>local prompt text before submit</td>
<td>AI interaction runtime</td>
</tr>
<tr>
<td>durable Chat/Agent turn</td>
<td>Omega resource/task capability</td>
</tr>
<tr>
<td>streamed partial text</td>
<td>AI runtime projection, marked partial</td>
</tr>
<tr>
<td>job/task state</td>
<td>Omega; mirrored by AI runtime</td>
</tr>
<tr>
<td>proposal preview</td>
<td>AI interaction/resource preview runtime</td>
</tr>
<tr>
<td>accepted resource change</td>
<td>resource capability/Omega</td>
</tr>
<tr>
<td>chosen Personality library asset</td>
<td>control plane/user library</td>
</tr>
<tr>
<td>materialized Project Agent/Personality copy</td>
<td>Project capability</td>
</tr>
</table>
Prompt-draft persistence is explicit and subject-separated. Do not place drafts in the Workspace aggregate unless its schema intentionally defines a draft envelope. Closing the Inspector takeover does not discard a recoverable draft.
## Modes and capabilities
Ask, Plan, and Action are the canonical V1 modes for Project Agents and Chat turns. The shell remains capability-driven: it renders only modes the admitted endpoint declares and explains why unavailable modes are disabled. It must not invent a fourth domain mode from a UI affordance.
Capability descriptors may additionally expose cited analysis, bounded task execution, scheduled/durable Agent work, context discovery, and change review inside those modes. Future modes require a versioned Omega contract. Regardless of mode, canonical mutations use typed capability operations and authorization.
## Quarterback dock
The dock owns:
- compact prompt field;
- current scope summary;
- Personality/Agent selector;
- context/attachment entry;
- submit/stop;
- latest run status;
- control to expand AI Inspector.
It stays compact and does not become a hidden full editor. Keyboard access, draft state, error state, and attachment removal are available without expanding.
The dock’s default scope follows the active tab, but a pinned explicit scope remains visible. Changing tabs never silently retargets a submitted task. A draft whose scope would change prompts or clearly updates before submission.
## AI Inspector takeover
The Inspector system captures the stable Resource selection and focus, then renders AI conversation/task/proposal content. Takeover is clearly labelled, reversible, and scoped.
- Selection remains intact.
- AI “show me” effects may reveal Context or a Resource target without applying a change.
- Plan/effect review shows exact targets, operation summary, permission implications, pending/conflict state, and evidence.
- V1 Accept submits the typed Ω-019 accept-plan command. A future capability-specific review may call its explicit typed transaction; reject/dismiss changes no Resource state.
- Completion can return automatically only when it will not disrupt active review; otherwise the user closes.
- Closing restores the selection Inspector and appropriate focus.
## Context and evidence
The AI runtime keeps two context classes separate.
**Authorized references** name Context assets, Resources, attachments, structured/media handles, prior turns, or stable selections. A reference includes kind, stable identity, locator/range when applicable, source revision, display label, and permission-safe preview. Omega reauthorizes it and may use it as provenance or citation evidence.
**Ephemeral context items** are labelled text supplied for one turn. Ω-019 bounds each item to 16 KiB and the combined ephemeral set to 32 KiB. They are untrusted prompt material, are not persisted as Resources, are not citations/evidence, and disappear after prompt assembly. Alpha never converts hidden cached Resource text into an ephemeral item to bypass reference authorization.
Context can come from:
- active Resource or stable selection;
- Project Context/resources;
- explicit user Context materialized or authorized for use;
- structured data/media capability handles;
- prior conversation turns;
- user-added files/resources;
- bounded user-authored or active-surface ephemeral context.
Retrieval results remain governed by Omega’s caller-aware access rules. Alpha never displays evidence metadata the caller cannot see. A per-turn Personality override is access-checked and version-snapshotted for that turn; it does not mutate a Chat Resource’s default Personality.
## Plan acceptance and capability effects
V1 does not assume a generic cross-Resource `AIProposal` endpoint. Ω-019 owns typed Agent Tasks, Plans, Runs, and the accept-plan transition. The frontend projects server-authored Plan steps and effect summaries, then submits `PlanAcceptance` with the expected Task revision and durable SubmissionID.
If a future capability exposes reviewable operations, every action must name its target aggregate and its own expected revision/precondition. One global `targetRevision` cannot safely cover a multi-target proposal. Acceptance routes through an explicit capability transaction; Alpha does not execute model-authored JavaScript, SQL, component names, arbitrary endpoint calls, or an unvalidated frontend action registry payload.
## Streaming and announcements
Streaming is bounded for accessibility and performance:
- partial content is marked as streaming;
- screen-reader announcements are throttled to meaningful chunks or completion;
- Stop remains reachable;
- reconnect resumes by canonical turn/run identity or shows a retry state;
- duplicated chunks/events are deduplicated;
- long output virtualizes visually without breaking reading/navigation semantics;
- citations and tool/proposal status remain associated with the correct turn.
## Faults
Distinct states include entitlement unavailable, Agent/Personality missing, context unauthorized, resource revision stale, task queued/running/paused/canceled/failed, rate limited, model unavailable, connectivity lost, and plan/effect acceptance refused. Toasts may supplement but never replace the persistent run/task fault.
## Current Alpha migration
Retain the current QuarterbackDock, AI agent system, personas, chats/turns/tasks actions, scope pinning, and AI Inspector presentation as behavioral seeds. Replace:
- direct coupling from QuarterbackDock to active Workspace and AI stores with an injected Project AI controller;
- permanent AI Inspector facet with temporary takeover;
- mock user owner-scoped Agent/Personality data with control-plane clients;
- any implicit resource scope with explicit stable references;
- component-owned async orchestration with runtime/controller state;
- frontend-assumed successful tool execution with durable task/run projections, Ω-014 change descriptors, and typed accepted effects.
## Tests
Cover draft lifecycle, tab change with pinned/unpinned scope, submitted-task survival across tab changes, explicit Project selection from user library, ephemeral-context bounds and non-persistence, unauthorized references, Personality version snapshot, streaming reconnect/deduplication, stop/retry, entitlement refusal, Plan review/accept/reject/stale Task revision, typed effect availability, AI Inspector takeover/restore, focus/announcements, Project switch, and disposal without cross-Project leakage.
## Sources
- <mention-page url="https://app.notion.com/p/3adb6410e5028189b4dcf8a6c7bda400"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281d887f1f53fcc2b5575"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281229fe9eec53047607c"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281bf8987c9a87e6687dd"/>
- [Current Alpha AI agent system](https://github.com/gccurtis/taurus-alpha/tree/d2b1bdcd02307f29ab4a895232cbf857d8157a56/src/lib/systems/ai-agent)
- [Current Alpha QuarterbackDock](https://github.com/gccurtis/taurus-alpha/blob/d2b1bdcd02307f29ab4a895232cbf857d8157a56/src/lib/features/shell/QuarterbackDock.svelte)

