# Data layer architecture migration

**Status:** Implemented — all 7 phases complete.

## Goal

Reorganize `src/lib/` from a flat collection of mixed-concern files into **systems** —
coherent units that own their domain's types, state, services, and lifecycle. A system
is a complete vertical slice: types + store + API + mocks + actions for one domain.

Introduce three layered **runtimes** (Session, Project, Resource) that enforce data
isolation at every boundary and enable sibling systems (Quarterback, panels, stages)
to coordinate through shared runtime objects rather than importing from each other.

The full runtime model is documented in
[2026-07-24-runtime-architecture.md](2026-07-24-runtime-architecture.md). This plan
covers the file reorganization that makes that model possible.

## Current problems

### 1. No identity system — 5 user shapes, 5 resolution paths

| Shape | Defined in | Purpose |
|---|---|---|
| `User` | `session.ts` | Auth session |
| `Member` | `projects.ts` | Project member list |
| `IdentityProfile` | `identity-directory.ts` | Rich hover card |
| `DocumentCollaborator` | `document-collaboration.ts` | Presence bar |
| `ActivityActor` | `overview.ts` | Feed snapshot |

The session user never acquires an `IdentityProfile`. No single place answers
"who is user X?"

### 2. No resource registry — siblings can't find each other

A document registry exists (`runtime.ts:1002`, `const runtimes = new Map<>`) with a
workspace watcher that manages lifecycle — but it's a private module-level map in the
document feature. The Quarterback dock imports `aiAgent` and `workspace` but has zero
awareness of open documents, so it composes prompts blindly. Panels, QB, and the stage
are siblings that need to coordinate through a shared resource runtime, but there is
no neutral ground for them to meet.

### 3. No Project Runtime — every stage loads data independently

`enterProjectResources()` is called redundantly by 4 components. The 409 retry
pattern is duplicated in `resources.ts`, `overview.ts`, `runtime.ts`. No project
lifecycle event that features subscribe to.

### 4. Data layer has no internal contract

Files arbitrarily mix types, API calls, stores, mock data, UI helpers, and actions.
A file's role is not predictable from its name or position.

### 5. `aiAgent` is global but should be project-scoped

The design law says strict project isolation. `workspace` is per-project, but
`aiAgent` is a single global writable. Switching projects preserves chat history
and context from the previous project.

### 6. Duplicate code

- 4 time formatters in 3 files
- `toKind()` byte-for-byte identical in `resources.ts` and `overview.ts`
- `slug()` 3 private copies
- 409 retry duplicated in `resources.ts`, `overview.ts`, `runtime.ts` (twice)
- `<Badge tone="attention">Mock</Badge>` duplicated 18+ times

## Systems — the organizing principle

Each system is a co-located directory that owns one domain end-to-end. It imports
from `$lib/data/` (shared data contracts) and `$lib/components/` (shared UI), but
never from another system. Cross-system coordination goes through `services/`.

### System boundaries

```
src/lib/
  services/                 ← cross-system coordinators
    identity.ts               one resolver for all user shapes
    project-context.ts        project lifecycle (single "project loaded" event)

  data/                     ← shared data contracts + infrastructure
    time.ts                   unified time formatting
    project-retry.ts          409 retry wrapper
    api.ts                    HTTP transport
    utils.ts                  slug(), cn(), useId()

  systems/                  ← domain systems (each = types + store + API + mocks + actions)
    session/
      index.ts                User, session store, signIn/Out, updateDisplayName
      types.ts
      store.ts
      api.ts

    projects/
      index.ts                Project, Member, ActivityEvent, project CRUD, member CRUD,
                              activity feed, role translation
      types.ts                Project, Member, Role, Visibility, IconColor, ShareLink,
                              ActivityActor, ActivityTarget, ActivityEvent, PublicUser
      store.ts                projects writable
      api.ts                  project CRUD, member CRUD, share links, profile update
      activity.ts             loadActivityPage, getPublicUser, getResourceMetadata,
                              activityStamp (all project-scoped)

    resources/
      index.ts                Resource, ResourceKind, catalog store, CRUD, registry
      types.ts
      store.ts                merged resourceCatalog (items + availableKinds)
      api.ts                  enterProjectResources, addResource, removeResource, renameResource
      registry.ts             ResourceRegistry — per-kind runtime factories, active(),
                              workspace subscriber for disposal/isolation

    workspace/
      index.ts                Tab, Workspace, tab manager (tab lifecycle + panel state)
      types.ts                (unchanged — already clean)

    documents/
      index.ts                Doc, Block, Row, Atom, change ops, API, layout types
      types.ts                document shape contracts
      api.ts                  getDocument, createDocument, appendChanges, etc.
      layout.ts               (moved from document-layout.ts)
      rows.ts                 (moved from document-rows.ts)
      inspector.ts            (moved from document-inspector.ts)
      collaboration.ts        DocumentCollaborator, documentBarCollaboration store
      context.ts              mock projections (comments, history, AI tasks, names, refs)

    identity-directory/
      index.ts                IdentityProfile, getIdentityProfile, identityProfileFromMember, etc.
      types.ts
      mocks.ts
      resolvers.ts

    ai-agent/
      index.ts                AiAgentState, aiAgent store, submitAiPrompt, acceptAiPlan, etc.
      types.ts
      copy.ts
      mocks.ts
      store.ts
      actions.ts

  features/shared/
    kinds.ts                   kindMeta (icon/tone/label per ResourceKind)
    surface.ts                 activeSurface contribution store
    project-colors.ts          iconDotClass, iconTileClass, ICON_COLORS

  components/
    MockBadge.svelte           shared mock indicator
```

### The Resource Registry — how siblings coordinate

The full model is in [2026-07-24-runtime-architecture.md](2026-07-24-runtime-architecture.md).
In summary:

```
QuarterbackDock ──┐
Panels ───────────┼──► resourceRegistry.active() → ResourceRuntime | null
  │                │
  ├─► getState()       → document content for context sources
  ├─► getSelection()   → selected text
  └─► info             → save status, title
```

Each resource kind registers a factory with the registry at app start. The registry
dispatches `acquire(kind, projectId, resourceId)` by looking up the factory. A
workspace subscriber disposes runtimes when tabs close or projects change.

The registry lives in `systems/resources/registry.ts`. It replaces the private Map
in `runtime.ts:1002` with a public, queryable, per-kind dispatcher.

### The Identity System — one resolver

```ts
// services/identity.ts

class UserService {
  resolveFromSession(user: User): IdentityProfile;
  resolveFromMember(member: Member): IdentityProfile;
  resolveFromName(name: string): IdentityProfile;
  resolveFromCollaborator(c: DocumentCollaborator): IdentityProfile;
}
```

All five user shapes collapse into one resolution path. When Omega ships a real
identity directory, only this service changes.

## Phases

### Phase 1: New infrastructure (additive — zero existing files changed)

- [ ] `src/lib/data/time.ts` + `.md` — unified time formatting (`relativeTime`, `documentEditStamp`, `documentEditRelative`, `activityStamp`)
- [ ] `src/lib/services/identity.ts` + `.md` — `UserService` (wrap identity-directory + add `resolveFromSession`)
- [ ] `src/lib/services/project-runtime.ts` + `.md` — `ProjectRuntime` (aggregates project data: members, catalog, activity; workspace subscriber for isolation)
- [ ] `src/lib/components/MockBadge.svelte` — shared mock indicator

### Phase 2: Unify utilities (remove duplicates)

- [ ] Export `slug()` from `src/lib/utils.ts`
- [ ] Update `transfer.ts`, `OverviewStage.svelte`, `NewTabStage.svelte` — import `slug` from `$lib/utils`, remove private copies
- [ ] Extract `toKind()` / `KNOWN_KINDS` from `resources.ts`, import into `overview.ts`, remove duplicate
- [ ] Create `src/lib/data/project-retry.ts` + `.md` — 409 retry wrapper
- [ ] Adopt retry wrapper in `resources.ts`, `overview.ts`, `runtime.ts`
- [ ] Migrate time callers to `data/time.ts` (DocumentStage, InfoPanel, ResourceTable, QuarterbackPanel, ActivityFeed)
- [ ] Remove `documentEditStamp`, `documentEditRelative` from `document-collaboration.ts`
- [ ] Remove `relativeTime` from `resources.ts`
- [ ] Remove `activityStamp` from `overview.ts`

### Phase 3: Create system directories (subdirs + barrels)

For each multi-file domain, create the system subdirectory with a barrel `index.ts`
that re-exports the same surface as the old flat file. Zero consumer changes.

**3a. ai-agent/** → 5 files + barrel:
- [ ] `systems/ai-agent/types.ts`, `copy.ts`, `mocks.ts`, `store.ts`, `actions.ts`
- [ ] `systems/ai-agent/index.ts` — barrel matching old `ai-agent.ts`
- [ ] Replace `data/ai-agent.ts` with `export * from '../systems/ai-agent/index.js'`
- [ ] Companions for all new files

**3b. identity-directory/** → 3 files + barrel:
- [ ] `systems/identity-directory/types.ts`, `mocks.ts`, `resolvers.ts`
- [ ] `systems/identity-directory/index.ts` — barrel matching old `identity-directory.ts`
- [ ] Replace `data/identity-directory.ts` with `export * from '../systems/identity-directory/index.js'`
- [ ] Companions for all new files

**3c. documents/** → bundle document data into one system:
- [ ] `systems/documents/types.ts` — all doc types from `documents.ts`
- [ ] `systems/documents/api.ts` — `getDocument`, `createDocument`, `appendChanges`, `resolvePromptBlock`, `getJob`
- [ ] `systems/documents/layout.ts` — moved from `document-layout.ts`
- [ ] `systems/documents/rows.ts` — moved from `document-rows.ts`
- [ ] `systems/documents/inspector.ts` — moved from `document-inspector.ts`
- [ ] `systems/documents/collaboration.ts` — moved from `document-collaboration.ts` (types + store, time helpers already removed)
- [ ] `systems/documents/context.ts` — moved from `document-context.ts` (mock projections)
- [ ] `systems/documents/index.ts` — barrel re-export
- [ ] Replace old flat files with `export * from` barrels
- [ ] Companions for all new files
- [ ] Note: `runtime.ts` (DocumentRuntime class) stays in `features/stages/document/` — it's editor implementation, not data. The resource registry in `systems/resources/` will call its factory.

**3d. session/** → 3 files:
- [ ] `systems/session/types.ts` — `User`
- [ ] `systems/session/store.ts` — `session` writable
- [ ] `systems/session/api.ts` — `hydrateSession`, `signIn`, `signOut`, `updateDisplayName`
- [ ] `systems/session/index.ts` — barrel
- [ ] Replace `data/session.ts` with barrel

**3e. projects/** → 5 files:
- [ ] `systems/projects/types.ts` — `Role`, `Visibility`, `Member`, `IconColor`, `Project`, `ShareLink`, `ActivityAction`, `ActivityActor`, `ActivityTarget`, `ActivityEvent`, `ActivityPage`, `PublicUser`, `ResourceMetadata`
- [ ] `systems/projects/store.ts` — `projects` writable
- [ ] `systems/projects/api.ts` — `fetchProjects`, `createProject`, `deleteProject`, `leaveProject`, `openProject`, member CRUD, share links, profile update
- [ ] `systems/projects/activity.ts` — `loadActivityPage`, `getPublicUser`, `getResourceMetadata` (folded from old `overview.ts`)
- [ ] `systems/projects/index.ts` — barrel
- [ ] Replace `data/projects.ts` + `data/overview.ts` with re-export barrels
- [ ] Move `iconDotClass`, `iconTileClass`, `ICON_COLORS` → `features/shared/project-colors.ts`

**3f. resources/** → 5 files:
- [ ] `systems/resources/types.ts` — `ResourceKind`, `Resource`, `RESOURCE_KINDS`
- [ ] `systems/resources/store.ts` — merged `resourceCatalog` writable (items + availableKinds)
- [ ] `systems/resources/api.ts` — `enterProjectResources`, `addResource`, `removeResource`, `renameResource`, `canCreate`
- [ ] `systems/resources/registry.ts` — `ResourceRegistry` class (per-kind factory Map, `acquire(kind,...)`, `active()`, workspace subscriber for dispose/isolation)
- [ ] `systems/resources/index.ts` — barrel
- [ ] Replace `data/resources.ts` with barrel

### Phase 4: Build the Resource Registry + per-kind registration

- [ ] Implement `systems/resources/registry.ts` — `ResourceRegistry` class:
  - `register(kind, factory)` — called once per resource kind at app init
  - `acquire(kind, projectId, resourceId, title)` — creates or returns existing runtime
  - `active()` — resolves current runtime from `workspace.activeTabId`
  - `get(key)` — direct lookup by composite key
  - Workspace subscriber: dispose runtimes on tab close, flush all on project change
- [ ] Register document kind in document system init:
  - `resourceRegistry.register('document', (projectId, resourceId, title) => createDocumentRuntime(projectId, resourceId, title))`
- [ ] Update `DocumentStage.svelte` to use `resourceRegistry.acquire('document', ...)` instead of `acquireDocument()`
- [ ] Update `WorkSurface.svelte` to use `resourceRegistry.active()` for runtime kind dispatch
- [ ] Wire `QuarterbackDock.svelte` to `resourceRegistry.active()` for context resolution
- [ ] Add `activeResourceId` / `activeResourceKind` to `AiAgentState` so the QB panel knows the current context
- [ ] Companions for all new and modified files

### Phase 5: Adopt runtimes + services + replace mock badges

- [ ] Adopt `UserService.resolveFromSession` in `UserSettingsDialog`
- [ ] Adopt `UserService.resolveFromMember` in projects page
- [ ] Adopt `UserService.resolveFromName` in ActivityFeed, AiTasksPanel, HistoryPanel, InfoPanel
- [ ] Adopt `UserService.resolveFromCollaborator` in DocumentStage, DocumentCollaboratorAvatar
- [ ] Adopt `ProjectRuntime` in `OverviewStage` — read catalog, activity, members from single runtime instead of calling `enterProjectResources()` directly
- [ ] Adopt `ProjectRuntime` in `NewTabStage` — same, for resource creation
- [ ] Replace 18+ inline mock badges with `<MockBadge />`
- [ ] Scope `aiAgent` store: workspace subscriber resets chats/plans/context on project switch
- [ ] Add panel section registry for project-level sections in `AppShell.svelte`
- [ ] Update all companions

### Phase 6: Import aliases

Add path aliases in `svelte.config.js` + `tsconfig.json` so systems import cleanly:

```
$data     → src/lib/data
$systems  → src/lib/systems
$services → src/lib/services
```

`$lib` remains for components, features, and cross-cutting utilities.

Update all imports across the codebase to use the new aliases.

### Phase 7: Final cleanup

- [ ] `pnpm check` → 0 errors / 0 warnings
- [ ] `pnpm build` → passes
- [ ] Remove stale flat files (the re-export barrels that have no remaining consumers)
- [ ] git status review — confirm no missed companions, no dangling references

## Migration constraints

1. **Every phase keeps the build green.** `pnpm check` and `pnpm build` pass before
   proceeding.
2. **Companions updated in the same change.**
3. **No feature changes.** Behavior, API calls, and UI output remain identical.
4. **Re-export barrels persist through Phase 5.** Import paths only change in Phase 6
   when aliases are introduced — until then, old `$lib/data/foo` imports still work.
5. **Systems never import from each other.** Cross-system coordination uses `services/`.

## Related plans

- [2026-07-24-runtime-architecture.md](2026-07-24-runtime-architecture.md) — the
  layered runtime model (Session → Project → Resource) this reorganization enables.
  The resource registry in Phase 4 is the runtime model's coordination primitive.
- [2026-07-23-identity-profile-manager.md](2026-07-23-identity-profile-manager.md) —
  Phase 1's `services/identity.ts` is its implementation.
- [2026-07-21-client-runtime-model.md](2026-07-21-client-runtime-model.md) — the
  original three-layer model. This plan generalizes the per-family manager into a
  public, queryable resource registry and adds the Project Runtime layer.
- [2026-07-21-panel-system-design.md](2026-07-21-panel-system-design.md) — Phase 5
  extends the contribution model to project-level sections.
