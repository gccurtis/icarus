---
title: "Α-060 — Multi-Client User Cell & Project Subcell Convergence E2E"
notion_page_id: "3adb6410e50281599a1efc22ff7b1dbc"
notion_url: "https://app.notion.com/3adb6410e50281599a1efc22ff7b1dbc"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 06:28:38Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Α-060 — Multi-Client User Cell & Project Subcell Convergence E2E

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Status:** Queued
> **Wave:** Wave 7 — Security, quality and production certification
> **Outcome:** Prove frontend isolation and convergence across multiple Workspace views, browser tabs/windows, Users, Projects, resources, concurrent operations, logout, session generations, and revocation.
## Why this packet exists
Prove frontend isolation and convergence across multiple Workspace views, browser tabs/windows, Users, Projects, resources, concurrent operations, logout, session generations, and revocation. This packet is bounded so an implementation agent can complete it without inventing adjacent architecture. It is not complete until the old behavior is either migrated with parity evidence or explicitly removed.
## Current Alpha evidence to inspect
- single-browser E2E emphasis
- Document-specific runtime tests
- ambient Project cross-tab vulnerability
The implementation begins by rechecking these surfaces at the packet's starting commit. Intervening source changes must be reconciled in the evidence note rather than silently overwritten.
## Scope and required deliverables
- Exercise same User/same Project, same User/different Projects, different Users/same Project, and logout/revocation matrices.
- Inject duplicate/gapped descriptors, delayed acknowledgements, conflicts, and reconnect.
- Verify Workspace, editors, AI, presence, jobs, and overlays dispose/recover correctly.
- Capture server revisions, client traces, and isolation evidence.
### Specific completion gate
One application's views reuse the intended runtime; independent browser realms retain independent memory; different Users never share frontend state; all clients converge through canonical Omega state without cross-Project leakage.
## Target boundary and contract
```typescript
interface CertificationRecord {
  baseline: string;
  scope: readonly CompletionMatrixRow[];
  automatedEvidence: readonly EvidenceArtifact[];
  manualEvidence: readonly ReviewArtifact[];
  sabotageEvidence: readonly EvidenceArtifact[];
  residuals: readonly ApprovedDeferral[];
}
```
This contract is illustrative of the ownership boundary; exact domain types come from the cited authorities and Omega wire contracts. Components do not perform transport, authorize operations, or own canonical business state. Alpha may predict eligible changes, but Omega remains authoritative.
## Svelte, HTML and visual implementation
Review the actual production HTML, component composition, tokens, responsive states, editor rendering, focus, and screenshots. Certification cannot pass on model tests alone. Styling values come only from the centralized visual authorities. Any intentional visual change must have before/after evidence and an updated component or screen fixture.
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
- Α-020
- Α-025
- Α-040
- Α-044
- Α-047
- Α-050
- Α-052
- Α-059
## Omega/backend prerequisites
- Ω-013: <mention-page url="https://app.notion.com/p/3acb6410e5028126b080c561a30f01f4"/>
- Ω-014: <mention-page url="https://app.notion.com/p/3adb6410e50281618bc7f02bda0e3670"/>
- Ω-027: <mention-page url="https://app.notion.com/p/3acb6410e50281e5a7b8f2ff2506c397"/>
- Ω-044: <mention-page url="https://app.notion.com/p/3acb6410e50281f5827efb0236dc64a5"/>
Frontend structure and deterministic fixtures may land before a backend prerequisite. Real-stack completion may not be claimed until the cited contract exists and passes end to end.
## Authorities and sources
- <mention-page url="https://app.notion.com/p/3adb6410e50281aca831cc1b970e1586"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502818fb987d5f5004117e3"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502814fabcad526f8abf0de"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502815497b0e1c1c60ef284"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281ff9601e70217f36c96"/>
- <mention-page url="https://app.notion.com/p/3acb6410e5028147909ef7214406baad"/>
- [Taurus Alpha at reviewed commit d2b1bdc](https://github.com/gccurtis/taurus-alpha/tree/d2b1bdcd02307f29ab4a895232cbf857d8157a56)

