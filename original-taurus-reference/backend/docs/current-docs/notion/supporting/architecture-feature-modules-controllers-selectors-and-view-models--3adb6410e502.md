---
title: "Architecture — Feature Modules, Controllers, Selectors & View Models"
notion_page_id: "3adb6410e50281ebb2fedff17e9ae7ff"
notion_url: "https://app.notion.com/3adb6410e50281ebb2fedff17e9ae7ff"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 05:44:46Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Architecture — Feature Modules, Controllers, Selectors & View Models

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Decision:** Alpha is assembled from statically registered feature modules. A feature module contributes controllers, selectors, view models, actions, routes/surfaces, and adapters through narrow contracts. It is not a runtime plugin, service locator, or bundle of components that calls its own APIs.
## Why this layer exists
Runtime controllers own long-lived state machines. Components own presentation. The feature layer connects them without letting either absorb the other’s responsibilities.
A feature module:
- declares its dependencies;
- acquires appropriate runtime ports at a composition root;
- exposes typed use-case controllers;
- derives immutable view models through pure selectors;
- contributes routes, actions, Context lenses, Inspector sections, overlays, or stages;
- composes feature views from the component library;
- releases every binding deterministically.
## Target source boundaries
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
    session/
    workspace/
    projects/
    resources/
    documents/
    spreadsheets/
    slides/
    chat/
    ai-agent/
    organizations/
    libraries/
  features/
    shell/
    project-directory/
    organization-admin/
    libraries/
    overview/
    agents/
    document/
    spreadsheet/
    slides/
    chat/
  components/
  data/
  routes/
```
### `runtime/*`
Content-agnostic coordination: acquisition, replicas, command queues, interaction, focus, overlays, connectivity, diagnostics. It does not switch on resource kind beyond supplied codecs/adapters.
### `systems/<capability>/*`
Capability-facing contracts and implementation:
- domain/frontend projection types;
- transport DTOs kept inside `api.ts` or `wire.ts`;
- client/gateway;
- DTO mapping;
- replica reducer/codec where applicable;
- typed commands/actions;
- capability tests.
A system does not import feature views.
### `data/*`
One narrow public facade per capability plus genuinely cross-capability application clients. Facades re-export intentional public contracts, not entire folders. A 300-line implementation in `data` is misplaced.
### `features/<feature>/*`
- `manifest.ts`: compile-time contribution metadata;
- `controller.ts`: use-case and workflow coordination;
- `selectors.ts`: pure derivation;
- `view-model.ts`: component-facing types;
- `composition.svelte`: runtime acquisition and binding;
- `components/*`: feature views;
- optional `context/*`, `inspector/*`, `overlays/*`, `actions/*`.
### `components/*`
Domain-neutral presentation and interaction patterns. No systems/data/features imports.
### `routes/*`
Scope guard/load, runtime acquisition, and screen composition. Route components do not contain capability data loaders duplicated from systems.
## Manifest and registration
```typescript
interface FeatureModule {
  id: string;
  dependencies: readonly FeatureDependency[];
  register(registrar: FrontendRegistrar): void;
}

interface FrontendRegistrar {
  route(definition: RouteDefinition): void;
  surface(module: SurfaceModule): void;
  action(definition: ActionDefinition<unknown, unknown>): void;
  overlay(definition: OverlayDefinition<unknown, unknown>): void;
  contextLens(definition: ContextLensContribution): void;
  inspectorSection(definition: InspectorSectionContribution): void;
}
```
Registration is static during application composition. The backend does not send executable modules, component names, or import paths. Remote capability descriptors may enable or disable a registered contribution.
The registrar validates duplicate IDs, missing dependencies, unsupported resource kinds, order conflicts, and illegal scope. Registration failure is an application build/startup fault, not an empty UI.
## Controllers
A controller implements one bounded use case or workflow.
```typescript
interface Controller<State, Intent> {
  readonly state: Readable<State>;
  handle(intent: Intent): Promise<InteractionOutcome>;
  dispose(): void;
}

function createResourceRenameController(
  resources: ResourceCommands,
  overlays: OverlayRuntime,
  navigation: NavigationRuntime
): Controller<ResourceRenameState, ResourceRenameIntent> {
  // owns draft and workflow; reads resource projection; submits typed command
}
```
Controllers receive dependencies explicitly. They may call several runtime ports when the use case truly coordinates them, but they do not import their concrete global stores. A controller cannot grant access, parse raw HTTP failures, or mutate another controller’s state.
Use one action implementation across toolbar, menu, shortcut, command palette, Inspector, and AI-accepted action. Interaction origins may affect focus/announcement, not domain semantics.
## Selectors
Selectors are pure functions from immutable runtime projections to immutable view models.
```typescript
type Selector<Input, Output> =
  (input: Readonly<Input>) => Readonly<Output>;

const selectProjectCard: Selector<ProjectProjection, ProjectCardModel> =
  (project) => ({
    id: project.id,
    name: project.name,
    ownerLabel: project.owner.displayName,
    canOpen: project.access.canReadContent,
    status: project.status
  });
```
Rules:
- no transport, timers, logging, navigation, or DOM;
- no mutation of input;
- explicit handling of loading/stale/refused/missing states;
- stable keys and order;
- memoization only after measurement;
- never infer permission from absent fields unless the system contract says absence is authoritative.
## View models
A view model is designed for one view contract, not a renamed backend DTO.
```typescript
interface InspectorFieldModel<T> {
  id: string;
  label: string;
  value: PropertyValue<T>;
  enabled: boolean;
  reason?: string;
  pending: boolean;
  error?: string;
}

interface FeatureScreenModel<T> {
  heading: string;
  content: Loadable<T>;
  primaryActions: readonly ActionPresentation[];
  notices: readonly NoticeModel[];
}
```
View models contain semantic data, labels, states, stable IDs, and action availability. They do not contain access tokens, arbitrary backend error bodies, Svelte components, DOM references, or closures except deliberately injected callback ports at the composition boundary.
## Composition and Svelte
Core controllers/selectors remain ordinary TypeScript. Svelte bridges subscribe and expose snapshots. `$derived` remains pure. `$effect` is used for external subscription, engine/DOM lifecycle, and teardown—not as a general dataflow engine or hidden command dispatcher.
Scoped Svelte context is appropriate at application, Project, resource, and compound-component roots. It is not a substitute for explicit dependencies at leaf components. Context values are typed and carry a scope identity to detect cross-Project misuse in development.
A composition component is small:
```javascript
<script lang="ts">
  const { projectRuntime, resourceId } = $props<Props>();
  const controller = createDocumentFeatureController(projectRuntime, resourceId);
  const model = fromReadable(controller.state);

  $effect(() => () => controller.dispose());
</script>

<DocumentView
  model={$model}
  onintent={controller.handle}
/>
```
## Cross-feature coordination
Use explicit shared contracts:
- Navigation runtime;
- Workspace commands;
- action registry;
- overlay runtime;
- selection service;
- unified history;
- Quarterback/AI scope;
- notification/announcement services.
A feature does not import another feature’s controller. If two features need the same domain operation, that operation belongs in a system/action port. If one workflow composes both, a higher-level feature controller depends on their public ports.
## Action model
```typescript
interface ActionDefinition<Payload, Result> {
  id: string;
  availability(context: ActionContext): ActionAvailability;
  run(context: ActionContext, payload: Payload): Promise<Result>;
}
```
An action has stable ID, scope, label/icon presentation metadata, availability reason, payload validation, controller implementation, effects, and telemetry identity. It is not synonymous with an Omega operation: an action may navigate, open a modal, update Workspace, submit one operation, or coordinate a transaction.
## Fault boundaries
- system clients decode transport faults;
- runtimes model sync/admission faults;
- controllers translate them into use-case recovery;
- selectors create presentable fault models;
- components render and emit retry/cancel/navigation events;
- render boundaries isolate feature/editor rendering, while async handlers remain explicitly caught.
No layer logs and swallows an invariant violation merely to keep a blank panel mounted.
## Current Alpha mapping
Strong seeds:
- `src/lib/systems/*` capability modules;
- one-facade-per-system convention in `src/lib/data/*`;
- Document `model/*`, `editor/session.ts`, and action table;
- Overview session/controller-like selection model;
- Resource runtime registry;
- shell components and component library.
Required extraction:
- move `data/workspace.ts` implementation into a Workspace system/runtime;
- split transport/DTO/store/capability logic in `systems/resources/api.ts`;
- split Slides domain/store/mock CRUD out of `systems/slides/types.ts`;
- choose one Project runtime and delete the unadopted alternative;
- replace global no-prop panel singleton reads with scoped bindings;
- split large feature components into controller/selectors/view model/focused views;
- remove mount-time data loading duplicated across routes, stages, and panels.
## Dependency enforcement
CI checks:
- components cannot import systems, data, runtime concretes, or features;
- runtime core cannot import Svelte components or resource implementations;
- systems cannot import features;
- features can import component public API and system/runtime public ports;
- transport DTOs cannot escape system gateway modules;
- Resource features cannot import other Resource feature implementations;
- all global listeners/subscriptions must use lifecycle helpers or explicit disposal.
Use TypeScript project boundaries, path aliases, ESLint/import rules, and the existing companion-document verifier. The exact enforcement tooling may reuse current free/open-source packages or a small local script.
## Tests
- selectors: exhaustive pure fixtures;
- controllers: fake ports, intent classification, faults, effects, disposal;
- manifests: duplicate/missing dependency and scope validation;
- composition: correct scope injection and no Project leakage;
- view models: loading/empty/offline/refused/conflict states;
- integration: same action from menu/shortcut/toolbar reaches one controller;
- import-boundary tests in CI.
## Sources
- <mention-page url="https://app.notion.com/p/3adb6410e50281ff9601e70217f36c96"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281d887f1f53fcc2b5575"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281aeae8ec87167771288"/>
- [Current Alpha contributor architecture](https://github.com/gccurtis/taurus-alpha/blob/d2b1bdcd02307f29ab4a895232cbf857d8157a56/AGENTS.md)
- [Svelte effect lifecycle](https://svelte.dev/docs/svelte/%24effect)
- [Svelte context](https://svelte.dev/docs/svelte/context)

