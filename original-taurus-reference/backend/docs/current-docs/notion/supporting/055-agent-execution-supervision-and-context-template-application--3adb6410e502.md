---
title: "Α-055 — Agent Execution, Supervision & Context/Template Application"
notion_page_id: "3adb6410e502813ca52dd0645d48d848"
notion_url: "https://app.notion.com/3adb6410e502813ca52dd0645d48d848"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 06:28:16Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Α-055 — Agent Execution, Supervision & Context/Template Application

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Status:** Queued
> **Wave:** Wave 6 — AI, ingestion and interchange
> **Outcome:** Implement Project Agents navigation and execution supervision for agent/personality selection, goals, plans/tasks, approval gates, tool activity, pause/resume/cancel, results, Context attachment, and Template instantiation.
## Why this packet exists
Implement Project Agents navigation and execution supervision for agent/personality selection, goals, plans/tasks, approval gates, tool activity, pause/resume/cancel, results, Context attachment, and Template instantiation. This packet is bounded so an implementation agent can complete it without inventing adjacent architecture. It is not complete until the old behavior is either migrated with parity evidence or explicitly removed.
## Current Alpha evidence to inspect
- AiAgentPanel/Quarterback surfaces
- `/library/agents user route`
- mock/project persona and task stores
The implementation begins by rechecking these surfaces at the packet's starting commit. Intervening source changes must be reconciled in the evidence note rather than silently overwritten.
## Scope and required deliverables
- Keep user Agent library/activity and Project Agents execution surfaces distinct.
- Support project-local Personality seed before user-library materialization is available.
- Reconcile plans/tasks/runs through durable backend state and transient stream updates.
- Provide accessible approvals, cancellation, background status, result reveal, and per-target refusal.
### Specific completion gate
Project Agents is a permanent admitted system tab; side-effecting work requires governed approval and backend authorization; task/run state is server-authored and stale Project runtimes cannot receive results.
## Target boundary and contract
```typescript
type AsyncProductState<T> =
  | { status: "idle" }
  | { status: "queued" | "running"; jobId: JobID; progress?: Progress }
  | { status: "succeeded"; result: T; receipt?: Receipt }
  | { status: "failed" | "cancelled"; fault: PresentableFault };
```
This contract is illustrative of the ownership boundary; exact domain types come from the cited authorities and Omega wire contracts. Components do not perform transport, authorize operations, or own canonical business state. Alpha may predict eligible changes, but Omega remains authoritative.
## Svelte, HTML and visual implementation
Implement complete Svelte/HTML workflows for queued/running/succeeded/partial/failed/cancelled states, with truthful progress, receipts, warnings, approvals, and recovery. Unsupported capability must be visibly honest. Styling values come only from the centralized visual authorities. Any intentional visual change must have before/after evidence and an updated component or screen fixture.
## Implementation sequence
1. Reconfirm the baseline, authorities, backend prerequisites, exact consumers, and current test behavior.
2. Add characterization tests and deterministic fixtures for the current happy path and known failure modes.
3. Introduce the target port/model/controller or component boundary behind a narrow adapter.
4. Implement the actual Svelte/HTML/visual states and migrate consumers in bounded slices.
5. Integrate with explicit scopes and typed gateways; run duplicate, conflict, cancellation, access-loss, and lifecycle sabotage.
6. Remove the superseded store, direct call, mock, placeholder, markup, CSS, or compatibility path; publish evidence.
## Accessibility, security and failure behavior
- Keyboard, focus, accessible names/relationships, announcements, zoom/reflow, reduced motion, and forced-color behavior are requirements, not final polish.
- Hidden UI never grants or denies access. The backend refusal is authoritative and must be presented without leaking inaccessible data.
- Credentials, connector tokens, raw backend bodies, restricted content, and editor payloads must not enter URLs, browser persistence, telemetry, or unsafe logs.
- Every asynchronous action has cancellation/late-completion behavior and prevents duplicate submission.
- Loading, stale, empty, offline, conflict, revoked, unsupported, and fatal states must be explicit where applicable.
## Tests and proof
- Unit: invariants, mappers, reducers, selectors, controllers, availability, and deterministic disposal within this packet.
- Component/DOM: semantic markup, keyboard/focus behavior, all load/error/permission/pending states, and accessibility assertions.
- Browser/visual: the primary workflow plus narrow/zoomed and failure screenshots against the pinned baseline.
- Integration: deterministic Omega fixtures and, once backend prerequisites land, the real Omega stack with explicit Project scope.
- Sabotage: cancellation, duplicate user input, delayed/duplicate responses, navigation/unmount, refusal, and recovery appropriate to the packet.
- Streaming-specific: transient versus durable state, stop/reconnect/duplicate deltas, restrained live announcements, and stale-scope rejection.
The acceptance sentence above must be translated into named test cases; a generic green suite is not sufficient proof.
## Migration and removal obligations
- Preserve aligned current behavior and markup only after it passes the target contract.
- Do not maintain two canonical runtimes, two component implementations, or a mock and production path after parity.
- Update companion architecture/component documentation and the completion census.
- Record any intentionally deferred behavior as a governing deferral; do not leave a no-op control or generic placeholder.
## Completion evidence required
- starting and ending commit SHAs plus changed-file list;
- exact test/lint/check/build commands and outputs;
- component/browser screenshots, traces, accessibility reports, and performance data as applicable;
- Omega baseline, fixture versions, requests/operations exercised, and real-stack result;
- removed files/paths and migrated consumers;
- residual gaps, rollback/recovery notes, and the next packet unblocked.
## Alpha packet dependencies
- Α-026
- Α-029
- Α-038
- Α-054
## Omega/backend prerequisites
- Ω-019: <mention-page url="https://app.notion.com/p/3adb6410e5028183ba41d764039f7930"/>
- Ω-020: <mention-page url="https://app.notion.com/p/3acb6410e502812eb0f3f4aca7e329be"/>
- Ω-031: <mention-page url="https://app.notion.com/p/3adb6410e5028192a491c1bb4a8d9097"/>
- Ω-038: <mention-page url="https://app.notion.com/p/3acb6410e5028112b3d7e37e3daa31d0"/>
- Ω-039: <mention-page url="https://app.notion.com/p/3acb6410e50281c2bd7aea5f19585153"/>
Frontend structure and deterministic fixtures may land before a backend prerequisite. Real-stack completion may not be claimed until the cited contract exists and passes end to end.
## Authorities and sources
- <mention-page url="https://app.notion.com/p/3adb6410e50281aca831cc1b970e1586"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502818fb987d5f5004117e3"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502814fabcad526f8abf0de"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281d7a7a9ef751b661ff4"/>
- <mention-page url="https://app.notion.com/p/3adb6410e5028163bf85c5fe95a8a163"/>
- <mention-page url="https://app.notion.com/p/3adb6410e5028109af17d131af989809"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281229fe9eec53047607c"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281d4a4d8ee542f91d595"/>
- [Taurus Alpha at reviewed commit d2b1bdc](https://github.com/gccurtis/taurus-alpha/tree/d2b1bdcd02307f29ab4a895232cbf857d8157a56)

