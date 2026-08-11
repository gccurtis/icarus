---
title: "Α-047 — Slides Shell, Thumbnails, Notes, Themes & Inspector"
notion_page_id: "3adb6410e5028180924fe360b82641f5"
notion_url: "https://app.notion.com/3adb6410e5028180924fe360b82641f5"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 06:27:58Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Α-047 — Slides Shell, Thumbnails, Notes, Themes & Inspector

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Status:** Queued
> **Wave:** Wave 5 — Editors and resource views
> **Outcome:** Complete the Slides stage chrome, stable slide navigation, thumbnails, sections, notes, layouts/templates/themes, Context, Inspector, presentation preview, status, and collaboration surfaces.
## Why this packet exists
Complete the Slides stage chrome, stable slide navigation, thumbnails, sections, notes, layouts/templates/themes, Context, Inspector, presentation preview, status, and collaboration surfaces. This packet is bounded so an implementation agent can complete it without inventing adjacent architecture. It is not complete until the old behavior is either migrated with parity evidence or explicitly removed.
## Current Alpha evidence to inspect
- SlideStage, SlideListPanel, notes/templates/actions panels
- duplicate low-fidelity thumbnail rendering
- mock templates/no-op AI and fake saved status
The implementation begins by rechecking these surfaces at the packet's starting commit. Intervening source changes must be reconciled in the evidence note rather than silently overwritten.
## Scope and required deliverables
- Use stable slide commands and keyboard-reorderable navigation.
- Provide full-fidelity bounded thumbnails from the canonical rendering path or a verified service.
- Make notes/background/layout/template/status real operations or explicit unavailable states.
- Wire exact Slides Context lenses and adaptive object/slide Inspector sections.
### Specific completion gate
Slide CRUD/reorder/hide/sections, notes, supported template/theme operations, selection Inspector, and two-client convergence round-trip against Omega with truthful capability states.
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
- Slides-specific: pointer/keyboard parity, stable object identity, remote no-echo, canvas teardown, and accessible object-tree evidence.
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
- Α-038
- Α-039
- Α-040
- Α-045
- Α-046
## Omega/backend prerequisites
- Ω-020: <mention-page url="https://app.notion.com/p/3acb6410e502812eb0f3f4aca7e329be"/>
- Ω-023: <mention-page url="https://app.notion.com/p/3acb6410e50281909acdce415f06e0db"/>
- Ω-024: <mention-page url="https://app.notion.com/p/3acb6410e5028144837de6ca4b89ccbe"/>
- Ω-037: <mention-page url="https://app.notion.com/p/3acb6410e502819cbe8ce2eab833514c"/>
Frontend structure and deterministic fixtures may land before a backend prerequisite. Real-stack completion may not be claimed until the cited contract exists and passes end to end.
## Authorities and sources
- <mention-page url="https://app.notion.com/p/3adb6410e50281aca831cc1b970e1586"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502818fb987d5f5004117e3"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502814fabcad526f8abf0de"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281dca00fe935ccb4b083"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281ae9244e2f9a57f579f"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281a7a32dd1c2551a7851"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281aeae8ec87167771288"/>
- [Taurus Alpha at reviewed commit d2b1bdc](https://github.com/gccurtis/taurus-alpha/tree/d2b1bdcd02307f29ab4a895232cbf857d8157a56)

