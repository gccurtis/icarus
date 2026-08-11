---
title: "Α-052 — Chat Composer, Streaming, Stop/Retry & Attachments"
notion_page_id: "3adb6410e5028123ab0be5c41a94665e"
notion_url: "https://app.notion.com/3adb6410e5028123ab0be5c41a94665e"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 06:28:16Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Α-052 — Chat Composer, Streaming, Stop/Retry & Attachments

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Status:** Queued
> **Wave:** Wave 5 — Editors and resource views
> **Outcome:** Complete the Chat Resource composer, resource/context attachments, submit, streaming projection, stop, retry, edit-and-branch, failure recovery, persona/agent options, Context and Inspector interactions.
## Why this packet exists
Complete the Chat Resource composer, resource/context attachments, submit, streaming projection, stop, retry, edit-and-branch, failure recovery, persona/agent options, Context and Inspector interactions. This packet is bounded so an implementation agent can complete it without inventing adjacent architecture. It is not complete until the old behavior is either migrated with parity evidence or explicitly removed.
## Current Alpha evidence to inspect
- no Chat composer/stage
- existing Quarterback dock/actions as noncanonical reference
- user Agent/Context/Template libraries
The implementation begins by rechecking these surfaces at the packet's starting commit. Intervening source changes must be reconciled in the evidence note rather than silently overwritten.
## Scope and required deliverables
- Separate ephemeral bounded/untrusted prompt context from authorized Context/resource/attachment/citation refs.
- Provide stream status and live regions that do not announce every token.
- Implement stop/retry/edit-and-branch through typed backend contracts and durable results.
- Keep Project AI/task state and Chat Resource state isolated despite shared primitives.
### Specific completion gate
Partial streams never become falsely confirmed state; interruption, reconnect, duplicate response, branch edit, access loss, and accessible announcement sabotage pass.
## Target boundary and contract
```typescript
interface EditorAdapter<State, Selection, Operation> {
  mount(host: HTMLElement, initial: Readonly<State>): void;
  applyProjection(next: Readonly<State>, origin: "bootstrap" | "remote" | "reconcile" | "ack"): void;
  selection(): Selection | null;
  setMode(mode: "editable" | "read-only" | "disabled"): void;
  destroy(): void;
  // Only local-user engine events may emit Operation.
}
```
This contract is illustrative of the ownership boundary; exact domain types come from the cited authorities and Omega wire contracts. Components do not perform transport, authorize operations, or own canonical business state. Alpha may predict eligible changes, but Omega remains authoritative.
## Svelte, HTML and visual implementation
The visible editor/viewer is a production deliverable. Preserve aligned existing markup, reconstruct flawed composition, and provide accessible non-pointer control surfaces for canvas/grid/virtualized content. Engine-specific CSS/state remains inside its adapter. Styling values come only from the centralized visual authorities. Any intentional visual change must have before/after evidence and an updated component or screen fixture.
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
- Α-008
- Α-022
- Α-023
- Α-024
- Α-038
- Α-039
- Α-051
## Omega/backend prerequisites
- Ω-019: <mention-page url="https://app.notion.com/p/3adb6410e5028183ba41d764039f7930"/>
- Ω-025: <mention-page url="https://app.notion.com/p/3acb6410e502819daf6ac7c1a67c5165"/>
- Ω-026: <mention-page url="https://app.notion.com/p/3acb6410e5028166993cc73270ff625e"/>
Frontend structure and deterministic fixtures may land before a backend prerequisite. Real-stack completion may not be claimed until the cited contract exists and passes end to end.
## Authorities and sources
- <mention-page url="https://app.notion.com/p/3adb6410e50281aca831cc1b970e1586"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502818fb987d5f5004117e3"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502814fabcad526f8abf0de"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281dca00fe935ccb4b083"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281d887f1f53fcc2b5575"/>
- <mention-page url="https://app.notion.com/p/3acb6410e5028173a1d0c6266bbe87c9"/>
- <mention-page url="https://app.notion.com/p/3acb6410e502815d9ba5ebc9389ecf63"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281d7a7a9ef751b661ff4"/>
- [Taurus Alpha at reviewed commit d2b1bdc](https://github.com/gccurtis/taurus-alpha/tree/d2b1bdcd02307f29ab4a895232cbf857d8157a56)

