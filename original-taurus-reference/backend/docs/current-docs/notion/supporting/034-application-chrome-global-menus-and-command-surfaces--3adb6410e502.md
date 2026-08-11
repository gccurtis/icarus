---
title: "Α-034 — Application Chrome, Global Menus & Command Surfaces"
notion_page_id: "3adb6410e502814e96c9fc41d1b29236"
notion_url: "https://app.notion.com/3adb6410e502814e96c9fc41d1b29236"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 06:27:40Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Α-034 — Application Chrome, Global Menus & Command Surfaces

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Status:** Queued
> **Wave:** Wave 3 — Shell, routes and control surfaces
> **Outcome:** Rebuild application chrome, top bars, user/Project menus, breadcrumbs, global command palette, shortcut help, degraded/offline banners, focus-region traversal, and responsive shell transitions on hardened components.
## Why this packet exists
Rebuild application chrome, top bars, user/Project menus, breadcrumbs, global command palette, shortcut help, degraded/offline banners, focus-region traversal, and responsive shell transitions on hardened components. This packet is bounded so an implementation agent can complete it without inventing adjacent architecture. It is not complete until the old behavior is either migrated with parity evidence or explicitly removed.
## Current Alpha evidence to inspect
- AppShell, ShellTopBar, TabStrip, SidePanel
- global menus and Quarterback dock
- current responsive shell CSS
The implementation begins by rechecking these surfaces at the packet's starting commit. Intervening source changes must be reconciled in the evidence note rather than silently overwritten.
## Scope and required deliverables
- Define four work regions consistently: Context, stage, Inspector, and Quarterback.
- Route all commands through the action registry and current scope.
- Expose sync/offline/degraded status without blocking unrelated local interaction.
- Replace pointer-only resize and ad-hoc focus jumps with shared runtime behavior.
### Specific completion gate
Desktop, narrow desktop, tablet-width, 200% zoom, keyboard-only, forced-color, reduced-motion, and visual-baseline suites pass with no transport or canonical state in chrome components.
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
- Α-009
- Α-010
- Α-024
- Α-026
## Omega/backend prerequisites
- Ω-010 (see <mention-page url="https://app.notion.com/p/3adb6410e50281e286aff541de343991"/>)
- Ω-014: <mention-page url="https://app.notion.com/p/3adb6410e50281618bc7f02bda0e3670"/>
Frontend structure and deterministic fixtures may land before a backend prerequisite. Real-stack completion may not be claimed until the cited contract exists and passes end to end.
## Authorities and sources
- <mention-page url="https://app.notion.com/p/3adb6410e50281aca831cc1b970e1586"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502818fb987d5f5004117e3"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502814fabcad526f8abf0de"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281b88424fd8694de4740"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281aeae8ec87167771288"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502810491c7eda475987775"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281a8b8edef96653bee7d"/>
- <mention-page url="https://app.notion.com/p/392b6410e50281f1a374fa89a941626a"/>
- [Taurus Alpha at reviewed commit d2b1bdc](https://github.com/gccurtis/taurus-alpha/tree/d2b1bdcd02307f29ab4a895232cbf857d8157a56)

