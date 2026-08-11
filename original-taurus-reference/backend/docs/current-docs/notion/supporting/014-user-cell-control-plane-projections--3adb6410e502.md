---
title: "Α-014 — User Cell Control-Plane Projections"
notion_page_id: "3adb6410e50281639bd6e45a0bce1611"
notion_url: "https://app.notion.com/3adb6410e50281639bd6e45a0bce1611"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 06:26:06Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Α-014 — User Cell Control-Plane Projections

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Status:** Queued
> **Wave:** Wave 2 — User Cell and Project Subcell runtime
> **Outcome:** Implement synchronized user-scoped projections for profile, Organization hierarchy, licenses/entitlements, Project discovery, Agents, Personal Context, Templates, preferences, and settings.
## Why this packet exists
Implement synchronized user-scoped projections for profile, Organization hierarchy, licenses/entitlements, Project discovery, Agents, Personal Context, Templates, preferences, and settings. This packet is bounded so an implementation agent can complete it without inventing adjacent architecture. It is not complete until the old behavior is either migrated with parity evidence or explicitly removed.
## Current Alpha evidence to inspect
- fixture-backed library routes
- User Settings and Organizations dialogs
- project directory loaders
The implementation begins by rechecking these surfaces at the packet's starting commit. Intervening source changes must be reconciled in the evidence note rather than silently overwritten.
## Scope and required deliverables
- Keep control-plane projections separate from Project content replicas.
- Model loading, stale, empty, refused, and unavailable fields explicitly.
- Materialize user-library items into independent Project-owned copies where authority requires.
- Never infer entitlements or authorization from hidden/disabled controls.
### Specific completion gate
Every user-level route operates without opening a Project Subcell; refresh, stale cache, mutation acknowledgement, refusal, and partial unavailability reconcile predictably.
## Target boundary and contract
```typescript
type FrontendScope =
  | { kind: "application" }
  | { kind: "user"; userCellId: UserCellID; generation: number }
  | { kind: "project"; userCellId: UserCellID; projectId: ProjectID; generation: number }
  | { kind: "resource"; projectId: ProjectID; resourceId: ResourceID };

interface OwnedRuntime {
  readonly scope: FrontendScope;
  dispose(reason: DisposeReason): void;
}
```
This contract is illustrative of the ownership boundary; exact domain types come from the cited authorities and Omega wire contracts. Components do not perform transport, authorize operations, or own canonical business state. Alpha may predict eligible changes, but Omega remains authoritative.
## Svelte, HTML and visual implementation
Runtime code remains framework-neutral, but every state it introduces must have a deliberate view-model and visible Svelte treatment. Do not hide pending, stale, conflict, refusal, reconnect, or disposal failures behind console logs. Styling values come only from the centralized visual authorities. Any intentional visual change must have before/after evidence and an updated component or screen fixture.
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
## Omega/backend prerequisites
- Ω-038: <mention-page url="https://app.notion.com/p/3acb6410e5028112b3d7e37e3daa31d0"/>
- Ω-039: <mention-page url="https://app.notion.com/p/3acb6410e50281c2bd7aea5f19585153"/>
- Ω-040: <mention-page url="https://app.notion.com/p/3acb6410e50281cab417e06f369b242a"/>
- Ω-041: <mention-page url="https://app.notion.com/p/3acb6410e502810d884cd50770f5352d"/>
Frontend structure and deterministic fixtures may land before a backend prerequisite. Real-stack completion may not be claimed until the cited contract exists and passes end to end.
## Authorities and sources
- <mention-page url="https://app.notion.com/p/3adb6410e50281aca831cc1b970e1586"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502818fb987d5f5004117e3"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502814fabcad526f8abf0de"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281ff9601e70217f36c96"/>
- <mention-page url="https://app.notion.com/p/3adb6410e5028163bf85c5fe95a8a163"/>
- <mention-page url="https://app.notion.com/p/3acb6410e5028106b617d05f162b5ddf"/>
- <mention-page url="https://app.notion.com/p/3acb6410e502814e928ae1f10eac6f75"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281d4a4d8ee542f91d595"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281229fe9eec53047607c"/>
- [Taurus Alpha at reviewed commit d2b1bdc](https://github.com/gccurtis/taurus-alpha/tree/d2b1bdcd02307f29ab4a895232cbf857d8157a56)

