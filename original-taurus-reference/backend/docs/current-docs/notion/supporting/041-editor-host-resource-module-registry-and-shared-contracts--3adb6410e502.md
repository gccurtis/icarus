---
title: "Α-041 — Editor Host, Resource Module Registry & Shared Contracts"
notion_page_id: "3adb6410e50281cfa7a0d588a264bc07"
notion_url: "https://app.notion.com/3adb6410e50281cfa7a0d588a264bc07"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 06:27:58Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Α-041 — Editor Host, Resource Module Registry & Shared Contracts

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Status:** Queued
> **Wave:** Wave 5 — Editors and resource views
> **Outcome:** Implement the engine-neutral lazy Resource module registry and lifecycle host for editable resources, read-only viewers, previews, and unsupported recovery surfaces.
## Why this packet exists
Implement the engine-neutral lazy Resource module registry and lifecycle host for editable resources, read-only viewers, previews, and unsupported recovery surfaces. This packet is bounded so an implementation agent can complete it without inventing adjacent architecture. It is not complete until the old behavior is either migrated with parity evidence or explicitly removed.
## Current Alpha evidence to inspect
- hard-coded WorkSurface branches
- Document-only runtime registry adoption
- placeholder for Spreadsheet/Chat/other kinds
The implementation begins by rechecking these surfaces at the packet's starting commit. Intervening source changes must be reconciled in the evidence note rather than silently overwritten.
## Scope and required deliverables
- Register runtime, adapter, Context, Inspector, actions, and transfers per resource kind.
- Permit a resource only when Omega capability and production module are both available.
- Use explicit local-user versus bootstrap/remote/reconcile/ack origins and no-echo tests.
- Keep ProseMirror, Fabric, grid, PDF, and viewer implementation types inside adapters.
### Specific completion gate
Mock modules prove acquisition, mount, projection application, selection, focus, mode changes, suspend/resume, lazy-load failure, render recovery, and deterministic destroy; shell code imports no editor engine.
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
- Α-010
- Α-018
- Α-020
- Α-021
- Α-023
- Α-025
## Omega/backend prerequisites
- Ω-015: <mention-page url="https://app.notion.com/p/3adb6410e50281f79473ede39876f743"/>
- Ω-017: <mention-page url="https://app.notion.com/p/3adb6410e50281999781e35c8dfacd05"/>
- Ω-021: <mention-page url="https://app.notion.com/p/3acb6410e5028101ad28de36426d1403"/>
- Ω-023: <mention-page url="https://app.notion.com/p/3acb6410e50281909acdce415f06e0db"/>
- Ω-025: <mention-page url="https://app.notion.com/p/3acb6410e502819daf6ac7c1a67c5165"/>
Frontend structure and deterministic fixtures may land before a backend prerequisite. Real-stack completion may not be claimed until the cited contract exists and passes end to end.
## Authorities and sources
- <mention-page url="https://app.notion.com/p/3adb6410e50281aca831cc1b970e1586"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502818fb987d5f5004117e3"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502814fabcad526f8abf0de"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281dca00fe935ccb4b083"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281ebb2fedff17e9ae7ff"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502815497b0e1c1c60ef284"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281b88424fd8694de4740"/>
- [Taurus Alpha at reviewed commit d2b1bdc](https://github.com/gccurtis/taurus-alpha/tree/d2b1bdcd02307f29ab4a895232cbf857d8157a56)

