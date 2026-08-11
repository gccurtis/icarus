---
title: "Α-026 — Semantic Router, Shell State Machine & Admission Guards"
notion_page_id: "3adb6410e5028156aba7c1722ca61e9a"
notion_url: "https://app.notion.com/3adb6410e5028156aba7c1722ca61e9a"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 06:27:23Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Α-026 — Semantic Router, Shell State Machine & Admission Guards

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Status:** Queued
> **Wave:** Wave 3 — Shell, routes and control surfaces
> **Outcome:** Implement route-scope state machines for public, User Cell, Organization administration, Project directory/settings, and admitted Project Subcell surfaces with deep-link restoration and typed recovery.
## Why this packet exists
Implement route-scope state machines for public, User Cell, Organization administration, Project directory/settings, and admitted Project Subcell surfaces with deep-link restoration and typed recovery. This packet is bounded so an implementation agent can complete it without inventing adjacent architecture. It is not complete until the old behavior is either migrated with parity evidence or explicitly removed.
## Current Alpha evidence to inspect
- root and project route loaders
- ambient session Project selection
- dialog-oriented user/admin surfaces
The implementation begins by rechecking these surfaces at the packet's starting commit. Intervening source changes must be reconciled in the evidence note rather than silently overwritten.
## Scope and required deliverables
- Add `/projects/:projectId/agents` as the permanent Project Agents system-tab route.
- Keep `/library/agents` as the separate user-level library/activity surface.
- Define safe return routes and clear scope transitions.
- Make Organization route tables exhaustive or explicitly representative of the Organization authority.
### Specific completion gate
User/Organization routes never open a Project Subcell; every Project route names its Project; loading, denial, not-found, revoked, degraded, session-expired, and recovery routes are deterministic.
## Target boundary and contract
```typescript
type RouteAdmission =
  | { status: "loading" }
  | { status: "ready"; scope: RouteScope }
  | { status: "denied" | "missing" | "revoked" | "degraded"; recovery: RecoveryAction[] };
```
This contract is illustrative of the ownership boundary; exact domain types come from the cited authorities and Omega wire contracts. Components do not perform transport, authorize operations, or own canonical business state. Alpha may predict eligible changes, but Omega remains authoritative.
## Svelte, HTML and visual implementation
Rebuild or preserve the real route/shell Svelte and HTML according to the responsibility boundary. Composition, landmarks, headings, focus order, responsive layout, empty/loading/error/permission states, and visual tokens are part of delivery. Styling values come only from the centralized visual authorities. Any intentional visual change must have before/after evidence and an updated component or screen fixture.
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
- Α-013
- Α-015
- Α-016
- Α-025
## Omega/backend prerequisites
- Ω-011: <mention-page url="https://app.notion.com/p/3acb6410e5028181902fd66656bb1f67"/>
- Ω-013: <mention-page url="https://app.notion.com/p/3acb6410e5028126b080c561a30f01f4"/>
- Ω-040: <mention-page url="https://app.notion.com/p/3acb6410e50281cab417e06f369b242a"/>
Frontend structure and deterministic fixtures may land before a backend prerequisite. Real-stack completion may not be claimed until the cited contract exists and passes end to end.
## Authorities and sources
- <mention-page url="https://app.notion.com/p/3adb6410e50281aca831cc1b970e1586"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502818fb987d5f5004117e3"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502814fabcad526f8abf0de"/>
- <mention-page url="https://app.notion.com/p/3adb6410e5028163bf85c5fe95a8a163"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281ff9601e70217f36c96"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281b88424fd8694de4740"/>
- <mention-page url="https://app.notion.com/p/3acb6410e5028147909ef7214406baad"/>
- [Taurus Alpha at reviewed commit d2b1bdc](https://github.com/gccurtis/taurus-alpha/tree/d2b1bdcd02307f29ab4a895232cbf857d8157a56)

