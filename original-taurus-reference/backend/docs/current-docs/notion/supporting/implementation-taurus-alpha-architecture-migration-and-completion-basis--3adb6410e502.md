---
title: "Implementation — Taurus Alpha Architecture Migration & Completion Basis"
notion_page_id: "3adb6410e502814fabcad526f8abf0de"
notion_url: "https://app.notion.com/3adb6410e502814fabcad526f8abf0de"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 05:31:05Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Implementation — Taurus Alpha Architecture Migration & Completion Basis

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Outcome:** Migrate the current Taurus Alpha incrementally into the target runtime/component architecture while preserving working behavior. This is a strangler program, not a rewrite. Each phase is independently testable and removes its compatibility path after parity.
## Baseline
Reviewed source: [Taurus Alpha commit d2b1bdc](https://github.com/gccurtis/taurus-alpha/tree/d2b1bdcd02307f29ab4a895232cbf857d8157a56).
Strong foundations to retain:
- SvelteKit/Svelte 5/TypeScript and the current route/feature/system/component layering;
- centralized `data/api.ts` fetch, cookies, CSRF, error decoding, and session-expiry hook;
- substantial component library and live catalog;
- Resource runtime registry;
- Document runtime/model/editor bridge and typed session/actions;
- Overview typed selection/session behavior;
- AppShell, TabStrip, SidePanel, PanelResults, WorkSurface, Quarterback;
- centralized theme/tokens and companion-document/test discipline;
- real Omega E2E harness.
Architectural debt to remove:
- ambient server-side selected Project and `withProject()`;
- monolithic `data/workspace.ts`, localStorage authority, opaque whole-state PUT, project-global panel state;
- unadopted `services/project-runtime.ts` alongside direct stage loads;
- hard-coded stage switch;
- global singleton no-prop panel sessions;
- permanent Details + AI Inspector;
- component-local overlay Escape/focus behavior;
- user/admin control-plane screens trapped in Project-shell dialogs;
- Slides mock domain/store in `types.ts`; Spreadsheet/Chat stage gaps;
- large feature components combining I/O, workflow, lifecycle, and markup;
- missing DOM accessibility/component contract tests.
The ambient Project problem is a correctness and isolation issue: browser tabs sharing one session cookie can retarget Omega’s selected Project while Project-scoped calls omit ProjectID. Workspace reads/writes are especially exposed. Explicit Project scope is therefore the first implementation gate.
## Target module map
```plain text
src/lib/
  runtime/
    application/
    project/
    replicas/
    interaction/
    overlays/
    focus/
  systems/
    <capability>/
      model.ts
      wire.ts
      client.ts
      mapper.ts
      reducer.ts
      controller.ts
      index.ts
  features/
    <feature>/
      manifest.ts
      controller.ts
      selectors.ts
      view-model.ts
      composition.svelte
      components/
      context/
      inspector/
      overlays/
  components/
  data/
  routes/
```
This is a target responsibility map, not a requirement to move every file before value ships.
## Migration waves
### Wave A0 — freeze the current behavioral baseline
- capture current unit/E2E counts and all real screens/routes;
- inventory every modal, menu, component export, global listener, store, client call, editor engine, and mock;
- add characterization tests for Project switching, Workspace restore, Document edits, panels, Quarterback, libraries, settings/share, and hydration;
- record screenshots/component fixtures for parity;
- run companion-document verification.
Exit: the team can prove whether later slices preserved behavior.
### Wave A1 — explicit Project scope and admission
- add `ProjectScope { projectId }` to every Project client;
- change Omega endpoints as required by the backend completion packets;
- remove new use of `POST /session/project`;
- eliminate `withProject()` retry retargeting;
- route loaders perform fresh admission before Project runtime acquisition;
- multi-tab E2E opens different Projects concurrently;
- Workspace GET/command APIs name ProjectID.
Exit: no Project request depends on mutable ambient session selection.
### Wave A2 — frontend kernel, faults, and dependency rules
- create application composition root;
- define typed control-plane/Project runtime registries;
- normalize client faults and cancellation;
- establish route scope contracts;
- add import-boundary CI rules;
- choose whether to adopt or delete `services/project-runtime.ts`;
- keep existing feature behavior behind adapters.
Exit: every current system can be reached through one declared runtime/client boundary.
### Wave A3 — revisioned Workspace controller
**Omega dependency:** corrected Ω-012 after Ω-010/011; Ω-014 completes durable multi-client invalidation.
- split `data/workspace.ts` into model, client, cache, replica/controller, commands, and selectors;
- implement confirmed/optimistic/pending/in-flight/error state;
- use one durable SubmissionID per command across retries and a separate per-attempt RequestID;
- implement only the governing `system | launcher | resource` tab kinds;
- model Overview and Project Agents as registry-owned pinned system tabs, New Tab as a launcher resolved in place, and preview as a read-only Resource adapter;
- implement stable-ID/before-anchor tab movement, undoable deliberate reordering, and non-undoable view/panel synchronization;
- preserve per-tab Context/Inspector/target/view state and workspace-wide token-clamped widths;
- add acknowledged cache, generation fencing, Project-specific runtimes, and Ω-014 descriptor/cursor refresh;
- coalesce high-frequency view state, submit structural commands immediately, and replace the opaque full-state PUT.
Exit: Workspace matches the current Primary model and is revisioned, conflict-safe, multi-client safe, and tested.
### Wave A4 — Resource and surface registries
**Omega dependencies:** Ω-015 Resource kernel; Ω-018 Overview; Ω-019 Project Agents; Ω-014 delivery.
- replace the `WorkSurface` resource-kind switch with a static module registry;
- separate runtime acquisition from view attachment;
- formalize Overview and Project Agents system modules, the New Tab launcher module, Resource/read-only preview adapters, and unsupported recovery;
- split `activeSurface` into Context definitions and an extensible adapter-owned `SelectionEnvelope<TTarget>` plus Inspector resolver;
- bind panels to explicit scoped controllers, not global singleton stores;
- add lazy-load, error-boundary, and deterministic disposal behavior.
Exit: adding a registered Resource kind requires no shell switch or panel imports, and the shell does not invent Workspace kinds or Inspector target unions.
### Wave A5 — feature modules and interaction controllers
- extract controllers/selectors/view models from large feature components;
- add action registry and shared action implementations;
- move all component callbacks through semantic intents;
- classify drafts, selection, previews, Workspace commands, capability operations;
- split resources API transport/DTO/store logic;
- split Slides mock runtime out of `types.ts`;
- establish Svelte subscription bridges and deterministic teardown.
Exit: no presentation component performs transport or direct capability-store mutation.
### Wave A6 — component and overlay hardening
- keep current visual component APIs where possible;
- build one overlay host/stack/layer/focus runtime;
- migrate dialogs/menus/popovers in bounded groups;
- move User Settings and Organization Administration to control-plane routes;
- add DOM component test environment, keyboard tests, focus trap/restore, axe supplement;
- implement keyboard resize and non-drag alternatives;
- consolidate CSS/TypeScript shell geometry into one token source.
Exit: current components meet their own accessibility contracts; overlay behavior no longer drifts by feature.
### Wave A7 — Context and Inspector runtimes
- persist stable Context lens IDs per tab;
- introduce Context definition/binding registry;
- introduce stable selection envelopes and adaptive Inspector section resolver;
- implement preview/commit/cancel for continuous properties;
- replace permanent AI facet with reversible takeover;
- reconcile the specialized Document, Spreadsheet, Slides, and Chat Context/Inspector Primary authorities;
- treat the shared rail/resolver pages as mechanics and each Resource Primary as content membership/operation authority.
Exit: selection cannot steal Context; Inspector adapts without resource switches in shell; AI restores selection.
### Wave A8 — Document adapter normalization
- add origin tagging and no-echo contract tests;
- split DocumentStage into view host, chrome/controller, presence, and composition;
- keep runtime view-independent across detach;
- formalize stable selection mapping, IME, clipboard, read-only, unified undo;
- decide with Omega whether whole-document diff remains or finer operations replace it;
- remove Document-only shell coupling.
Exit: Document passes the common Resource adapter suite without losing current behavior.
### Wave A9 — complete core Resource editors
**Omega dependencies:** Template Ω-020; Spreadsheet Ω-021–022; Slides Ω-023–024; Chat Ω-019 and Ω-025–026; unified history Ω-027.
- build the one-grid Spreadsheet runtime/formula adapter with SpreadsheetID, RowID, ColumnID, CellID, RangeRef, and revision-bound A1 projection—never sheets/tabs;
- migrate Slides from local mock to a canonical, engine-neutral canvas/object adapter; choose or retain a library only in an implementation packet with free/open-source license and fit review;
- build the revisioned Chat Prompt+Response turn-tree/conversation adapter;
- supply each Resource’s Context, Inspector, operations, accessibility, history, conflict behavior, and common adapter contract suite.
Exit: Document, Spreadsheet, Slides, and Chat use canonical Omega state and pass the lifecycle/no-echo/selection/accessibility suite.
### Wave A10 — Project Overview, Agents, and Quarterback
**Omega dependencies:** Ω-018–019; Chat integration Ω-025–026; shared access/change contracts Ω-008–010 and Ω-014.
- project Ω-018 details/resources/activity/tasks/health descriptors into the Overview Context and work surface;
- expose `/projects/:projectId/agents` as the admitted deep route that activates the Project Agents system tab;
- implement the injected Project AI runtime with canonical Ask/Plan/Action modes;
- separate bounded ephemeral context from authorized Resource/Context/attachment references;
- present transient streaming separately from durable turns, Tasks, Runs, and effects;
- implement typed Ω-019 Plan acceptance and preserve submitted work across ordinary Workspace-tab changes.
Exit: Project Overview and AI are fully Project-scoped without waiting for mutable enterprise/user-library policy.
### Wave A11 — ingestion, connectors, and interchange surfaces
**Omega dependencies:** multi-lattice/router Ω-028–031; connector/source lifecycle Ω-032–033; worker and conversion Ω-034–037; Resource/jobs/live Ω-014–015.
- implement unknown-file classification and user choice among text, structured data/table, and picture/media, while requiring parser byte validation;
- build upload/source lifecycle, processing, retry, cancellation, progress, and durable fault states;
- add structured-data and media catalog/search/preview/reveal surfaces governed by caller-safe descriptors;
- implement connector creation, validation, credential-safe status, source selection, synchronization, revocation, and recovery;
- implement import/export option overlays, asynchronous job progress, output artifacts/downloads, conversion warnings, and typed errors for DOCX, PDF, XLSX, and PPTX flows;
- keep OCR provenance and derived-text labeling visible where relevant.
Exit: every supported ingest, connector, preview, and interchange workflow is backend-connected and recoverable.
### Wave A12 — user libraries and enterprise control plane
**Omega dependencies:** user libraries Ω-038–039; identity/organization/ownership/grants Ω-040; settings/admin/entitlements/audit Ω-041.
- connect user Context, Template, and Personality libraries to Omega;
- finish durable library detail routes and explicit Project materialization;
- build all Organization Administration sections—Overview, People, Organization, Projects, Access reviews, Security & identity, Plan & usage, Audit, and Danger—with authority-owned deep-link/focus/recovery behavior;
- finish user and Project settings routes;
- add entitlement/access recovery without capability-layer billing calls.
Route shells may land earlier with typed unavailable states, but this wave cannot pass on mocks.
Exit: every non-Project control-plane surface is real, explicitly scoped, and backend-connected.
### Wave A13 — deployment, verification, and legacy removal
**Omega dependencies:** production storage Ω-042; single-node packaging Ω-043; certification Ω-044.
- verify two-client, multi-browser-instance, multi-tab, and multi-Project convergence;
- test offline/reconnect/refusal/conflict/admission revocation and durable Project-change cursor recovery;
- run keyboard-only, screen-reader/manual, zoom, forced-colors, and reduced-motion gates;
- enforce performance budgets for boot, Project admission, editor load, and large Resource projections;
- complete CSP/CSRF/session/cache, privacy, dependency-license, and deployment-configuration audits;
- certify canonical end-to-end demos, import/export jobs, connectors, restart/recovery, and production serving;
- remove ambient Project selection, opaque Workspace paths, mocks, old panel arrays, duplicate stores, direct fetches, and migration flags;
- update orientation and companion docs.
Exit: Alpha satisfies the completion gate below, works with the production Omega topology, and contains no silent legacy authority.
## Current-to-target file mapping
<table header-row="true">
<tr>
<td>Current path</td>
<td>Target treatment</td>
</tr>
<tr>
<td>`src/lib/data/api.ts`</td>
<td>retain as low-level transport; add scoped typed clients above it</td>
</tr>
<tr>
<td>`src/lib/data/project-retry.ts`</td>
<td>delete after explicit Project APIs</td>
</tr>
<tr>
<td>`src/lib/data/workspace.ts`</td>
<td>split into Workspace system/runtime/cache/selectors</td>
</tr>
<tr>
<td>`src/lib/services/project-runtime.ts`</td>
<td>adopt as real registry facade or delete</td>
</tr>
<tr>
<td>`src/lib/features/shared/surface.ts`</td>
<td>replace with Context registry + Inspector resolver + module manifest</td>
</tr>
<tr>
<td>`src/lib/features/shell/WorkSurface.svelte`</td>
<td>registry-driven StageHost</td>
</tr>
<tr>
<td>`src/lib/features/shell/SidePanel.svelte`</td>
<td>retain presentational shell; inject accessible resize and region-specific host</td>
</tr>
<tr>
<td>`src/lib/features/stages/document/runtime.ts`</td>
<td>retain/refine as reference Resource runtime</td>
</tr>
<tr>
<td>`DocumentStage.svelte`</td>
<td>split lifecycle/chrome/presence/view</td>
</tr>
<tr>
<td>`src/lib/systems/slides/types.ts`</td>
<td>split model/runtime/client/mock fixture</td>
</tr>
<tr>
<td>`src/lib/systems/resources/api.ts`</td>
<td>split wire/client/mapper/store/actions</td>
</tr>
<tr>
<td>`UserSettingsDialog.svelte`</td>
<td>account settings route</td>
</tr>
<tr>
<td>`OrganizationsDialog.svelte`</td>
<td>organization admin route</td>
</tr>
<tr>
<td>`src/lib/components/*`</td>
<td>retain; harden contracts; enforce import boundary</td>
</tr>
<tr>
<td>`src/app.css`  • TS geometry</td>
<td>one authoritative typed/tokenized geometry source</td>
</tr>
</table>
## Verification pyramid
### Pure/unit
Reducers, operation codecs, selectors, controllers, Workspace command rebase, inspector value models, action availability, scope generation, focus target resolution.
### Component DOM
Every exported interactive component: role/name/state, keyboard, focus, disclosure, invalid/read-only/loading, reduced motion. Shared rails, resize handles, overlays, menus and compound fields.
### Contract integration
Fake Omega clients for replica queues, duplicate acknowledgment, remote interleave, revision gap, refusal, reconnect, disposal. Common Resource editor adapter suite.
### Real Omega E2E
Sign-in, project selection, two Projects in separate tabs, Workspace convergence, resources, editors, Context/Inspector, Quarterback, libraries, settings/admin, access revocation, connector/import/export, conflict/retry.
### Manual/release
Screen-reader/editor passes, high zoom/reflow, forced colors, large datasets/resources, security/privacy inspection, license manifest.
## Completion gate
Alpha is architecturally complete when:
- every Project request explicitly names ProjectID;
- user/admin routes create no Project runtime unless the user opens a Project;
- one ref-counted frontend Project runtime serves its views within an application instance;
- every canonical aggregate uses a declared replica/reconciliation strategy;
- no component or engine calls transport directly;
- no component owns a second durable copy of domain state;
- every visible mutation maps to one typed controller/action;
- every screen, route, modal/menu family, Context lens, Inspector section, and V1 Resource adapter is catalogued;
- Document, Spreadsheet, Slides, Chat, and preview adapters pass the lifecycle/no-echo/selection/accessibility suite;
- closing/suspending a view cannot lose pending work;
- loading, empty, offline, forbidden, refused, conflict, and fatal recovery states exist;
- import boundaries and companion documents pass CI;
- keyboard-only and automated accessibility coverage exists;
- two clients converge on Omega state;
- all external dependencies are free/open-source and license-reviewed;
- mocks, ambient selected-Project behavior, and compatibility paths are removed.
## Work-packet derivation
Turn each wave into independently reviewable packets organized by vertical slices. Every packet states:
- current files and behavior;
- governing Notion authorities;
- required Omega endpoint/contract;
- target modules and dependency changes;
- data migration/cache compatibility;
- accessibility behavior;
- tests and evidence;
- rollback/feature flag;
- deletion criteria for old paths.
The first implementation packet is explicit Project scope, not visual refactoring.
## Risks
- Omega revisions/idempotency may be insufficient for a generic replica protocol.
- a generic Resource store may erase capability-specific semantics;
- Workspace fields can cause devices to fight if durable versus ephemeral ownership is unclear;
- engine-native undo can diverge from canonical history;
- global Svelte state can leak across Projects, tests, or SSR requests;
- overlay migration can race navigation and async completion;
- resource editors can leak vendor types;
- premature offline mutation persistence can create unrecoverable conflicts;
- accessibility can be lost during “visual parity” refactors;
- central styling can become global-selector coupling instead of tokens;
- a feature registry can become a service locator unless composition remains static and typed.
## Sources
- <mention-page url="https://app.notion.com/p/3adb6410e502818fb987d5f5004117e3"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281bf8987c9a87e6687dd"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281d2813fe9f261c35ac4"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281b2999bce58d559d902"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281e286aff541de343991"/>
- [Taurus Alpha reviewed commit](https://github.com/gccurtis/taurus-alpha/commit/d2b1bdcd02307f29ab4a895232cbf857d8157a56)
## Executable completion program
This migration basis is translated into the ordered, evidence-bearing packet set at <mention-page url="https://app.notion.com/p/3adb6410e50281aca831cc1b970e1586"/>. The packet program governs execution status and completion gates; this page remains the architectural migration rationale.

