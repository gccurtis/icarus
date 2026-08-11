---
title: "Architecture — Taurus Alpha Frontend System Index"
notion_page_id: "3adb6410e502818fb987d5f5004117e3"
notion_url: "https://app.notion.com/3adb6410e502818fb987d5f5004117e3"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-30 05:31:05Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Architecture — Taurus Alpha Frontend System Index

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Authority:** This is the governing index for the Taurus Alpha target architecture. It reconciles current Alpha implementation with the Taurus Yesod product and Omega runtime authorities. Where a historical frontend document conflicts with this corpus, this corpus governs.
## Executive decision
Taurus Alpha is an optimistic, accessible projection of Taurus Omega. Its job is to perform three things well:
1. keep local projections synchronized with canonical backend state;
2. interpret user interaction into typed frontend intent; and
3. compile eligible intent into explicit operations for Omega, then reconcile the result.
Presentation components do not own that loop. Components render state and emit semantic events. Feature interaction controllers interpret those events. Frontend runtimes own state machines and coordination. System clients speak transport. Omega owns authorization, canonical resources, revisions, jobs, and audit.
This is a modular frontend, not a universal event runtime. It does not reintroduce the historical translator graph, render-provider architecture, or client-side domain authority.
## Corpus map
<table header-row="true">
<tr>
<td>Order</td>
<td>Authority</td>
<td>Governs</td>
</tr>
<tr>
<td>1</td>
<td><mention-page url="https://app.notion.com/p/3adb6410e50281ff9601e70217f36c96"/></td>
<td>runtime layers, state classes, lifecycle, dependency direction</td>
</tr>
<tr>
<td>2</td>
<td><mention-page url="https://app.notion.com/p/3adb6410e502815497b0e1c1c60ef284"/></td>
<td>confirmed state, optimistic overlays, queues, conflict and reconnect</td>
</tr>
<tr>
<td>3</td>
<td><mention-page url="https://app.notion.com/p/3adb6410e50281d887f1f53fcc2b5575"/></td>
<td>component event → intent → command → Omega operation</td>
</tr>
<tr>
<td>3A</td>
<td><mention-page url="https://app.notion.com/p/3adb6410e50281ebb2fedff17e9ae7ff"/></td>
<td>feature manifests, controllers, selectors, view models, composition boundaries</td>
</tr>
<tr>
<td>4</td>
<td><mention-page url="https://app.notion.com/p/3adb6410e5028163bf85c5fe95a8a163"/></td>
<td>public, user, organization, directory, and project route families</td>
</tr>
<tr>
<td>5</td>
<td><mention-page url="https://app.notion.com/p/3adb6410e50281b88424fd8694de4740"/></td>
<td>shell, Workspace, tabs, stages, resource-runtime acquisition</td>
</tr>
<tr>
<td>6</td>
<td><mention-page url="https://app.notion.com/p/3adb6410e50281aeae8ec87167771288"/></td>
<td>component tiers and composition rules</td>
</tr>
<tr>
<td>7</td>
<td><mention-page url="https://app.notion.com/p/3adb6410e50281a8b8edef96653bee7d"/></td>
<td>focus, keyboard, announcements, drag alternatives, testing</td>
</tr>
<tr>
<td>8</td>
<td><mention-page url="https://app.notion.com/p/3adb6410e502810491c7eda475987775"/></td>
<td>modal, drawer, popover, menu, tooltip, toast, transient workflow</td>
</tr>
<tr>
<td>9</td>
<td><mention-page url="https://app.notion.com/p/3adb6410e5028109af17d131af989809"/></td>
<td>Context rail, stable lens registry, lens content lifecycle</td>
</tr>
<tr>
<td>9A</td>
<td><mention-page url="https://app.notion.com/p/3adb6410e502810dae4ae1b4866d8c6d"/></td>
<td>authoritative Document Context lens membership, models, operations, and states</td>
</tr>
<tr>
<td>10</td>
<td><mention-page url="https://app.notion.com/p/3adb6410e5028189b4dcf8a6c7bda400"/></td>
<td>selection model and adaptive Inspector</td>
</tr>
<tr>
<td>10A</td>
<td><mention-page url="https://app.notion.com/p/3adb6410e502816fbecde3c54898886b"/></td>
<td>authoritative Document Inspector targets, sections, controls, and operations</td>
</tr>
<tr>
<td>11</td>
<td><mention-page url="https://app.notion.com/p/3adb6410e50281dca00fe935ccb4b083"/></td>
<td>resource host, adapters, editor runtimes, ProseMirror boundary</td>
</tr>
<tr>
<td>12</td>
<td><mention-page url="https://app.notion.com/p/3adb6410e50281d7a7a9ef751b661ff4"/></td>
<td>Quarterback dock, AI Inspector takeover, tasks and scope</td>
</tr>
<tr>
<td>13</td>
<td><mention-page url="https://app.notion.com/p/3adb6410e502814fabcad526f8abf0de"/></td>
<td>current-to-target migration and completion gates</td>
</tr>
</table>
## Architecture map
<table header-row="true">
<tr>
<td>Layer</td>
<td>Owns</td>
<td>Must not own</td>
</tr>
<tr>
<td>Route and scope gate</td>
<td>route matching, authentication gate, explicit Project admission, error/recovery boundary</td>
<td>permission policy or a mutable authoritative “selected Project”</td>
</tr>
<tr>
<td>Projection runtime</td>
<td>confirmed projections, optimistic overlays, pending operations, subscriptions/polling, reconciliation</td>
<td>component rendering or hidden component state</td>
</tr>
<tr>
<td>Interaction runtime</td>
<td>focus/selection coordination, drafts, typed intents, workflow state, reveal behavior</td>
<td>canonical business state</td>
</tr>
<tr>
<td>Feature controller</td>
<td>converts semantic UI events into runtime commands; maps results into user feedback</td>
<td>HTTP details, raw persistence, global event broadcasting</td>
</tr>
<tr>
<td>System client/data facade</td>
<td>typed request/response contracts, decoding, cancellation, transport errors</td>
<td>view composition</td>
</tr>
<tr>
<td>Components</td>
<td>semantics, accessibility, styling states, layout, events</td>
<td>transport, authorization, canonical state, direct feature-store mutation</td>
</tr>
<tr>
<td>Omega</td>
<td>authorization, User Cell / Project Subcell execution, canonical state, revision control, audit</td>
<td>local focus, hover, drafts, optimistic presentation</td>
</tr>
</table>
## Scope model
Alpha has five route scopes:
- **Public:** boot, sign-in, join/invitation, authentication recovery.
- **Signed-in user:** project directory, account settings, Context/Template/Personality libraries.
- **Organization administration:** organization tree, members, grants, owned projects, licenses and policy. This is a control-plane console, not a content application.
- **Project directory/settings:** explicit Project metadata and access administration after fresh admission.
- **Project execution:** workbench, Project Overview, Project Agents, resources, Workspace, Context, Inspector, and Quarterback.
A session authenticates a User. It never authoritatively scopes all later calls to one selected Project. Every Project request carries its Project identity and is admitted by the control plane before reaching `UserCell(UserID) → ProjectSubcell(UserID, ProjectID)`.
## Runtime composition
The application runtime owns long-lived, scope-neutral services. It acquires control-plane projections for user routes and a Project runtime for each opened Project. Within one browser application instance, one frontend Project runtime may serve multiple Workspace tabs and route consumers. Browser tabs/windows do not share that memory implicitly. Omega maps it to that User's logical `(UserID, ProjectID)` Project Subcell; another User collaborating in the same Project has a distinct subcell. Each open resource tab acquires a view-independent Resource runtime. Mounting or unmounting a stage attaches or detaches a view; it does not recreate canonical resource state.
## Current implementation and target
<table header-row="true">
<tr>
<td>Current Alpha</td>
<td>Target treatment</td>
</tr>
<tr>
<td>SvelteKit routes, Svelte 5, typed systems/data/features/components layers</td>
<td>retained</td>
</tr>
<tr>
<td>stores/actions and resource-specific editor modules</td>
<td>retained, normalized behind runtime/controller contracts</td>
</tr>
<tr>
<td>localStorage workspace boot mirror and opaque whole-state PUT</td>
<td>replaced by acknowledged cache plus revisioned Workspace commands</td>
</tr>
<tr>
<td>project-global panel state</td>
<td>replaced by per-tab Context/Inspector state with workspace-wide widths</td>
</tr>
<tr>
<td>active surface contributes Context and Inspector sections</td>
<td>split into stable Context definitions and an adaptive Inspector resolver</td>
</tr>
<tr>
<td>shell hard-codes stage kinds</td>
<td>registry-driven Resource host</td>
</tr>
<tr>
<td>current generic Inspector permanently exposes Details and AI</td>
<td>selection Inspector is stable; Quarterback can temporarily take over and restore it</td>
</tr>
<tr>
<td>current Modal/Menu/Popover primitives</td>
<td>hardened through one overlay runtime and accessibility contract</td>
</tr>
<tr>
<td>Document/ProseMirror runtime</td>
<td>retained as the reference Resource adapter, not promoted to application runtime</td>
</tr>
<tr>
<td>Slides local mock; Spreadsheet and Chat stages incomplete</td>
<td>completed through the common Resource host/adapter contract</td>
</tr>
<tr>
<td>user libraries use mock owner-scoped data</td>
<td>connected to explicit control-plane endpoints when Omega packets land</td>
</tr>
</table>
## Styling dependency
This corpus does not restate Taurus styling. Components consume the centralized semantic/component/resource tokens and the existing visual-system authorities. Runtime and feature code never introduce colors, type scales, shadows, radii, motion constants, or layout constants. Shell dimensions are tokenized; surface adapters may declare preferences within those centralized bounds.
## Definition of frontend architecture complete
The architecture is complete when:
- every route has one explicit scope gate and error/recovery model;
- every canonical projection has a declared owner and synchronization strategy;
- every user action can be classified as ephemeral UI state, Workspace command, control-plane command, Project capability operation, or AI command;
- no component performs transport or owns canonical business state;
- every resource kind enters the shell through the same host contract;
- Context and Inspector follow their separate settled semantics;
- all overlays use one focus/stack runtime;
- keyboard, focus, announcements, reduced motion, and non-drag alternatives are tested;
- migration work can be expressed as bounded implementation packets without architectural inference.
## Sources
- <mention-page url="https://app.notion.com/p/3abb6410e50281d5aa7adf2254bbac57"/>
- <mention-page url="https://app.notion.com/p/3acb6410e502812bb4e0ff2c91ff753f"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281ddaa6dca8f6e1802fb"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281bf8987c9a87e6687dd"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502810dae4ae1b4866d8c6d"/>
- <mention-page url="https://app.notion.com/p/3adb6410e502816fbecde3c54898886b"/>
- <mention-page url="https://app.notion.com/p/392b6410e50281f1a374fa89a941626a"/>
- [Taurus Alpha at reviewed commit d2b1bdc](https://github.com/gccurtis/taurus-alpha/tree/d2b1bdcd02307f29ab4a895232cbf857d8157a56)
- [Current Alpha orientation](https://github.com/gccurtis/taurus-alpha/blob/d2b1bdcd02307f29ab4a895232cbf857d8157a56/docs/orientation/AGENT-ORIENTATION.md)
## Completion execution
The implementation order, packet gates, backend prerequisites, visual/component reconstruction, editor verticals, and final certification are governed by <mention-page url="https://app.notion.com/p/3adb6410e50281aca831cc1b970e1586"/>.

