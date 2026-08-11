# Runtime architecture — layered isolation and sibling coordination

**Status:** Implemented — resource registry built, QB wired, document factory registered —
**with one deliberate divergence** (recorded 2026-07-27, reorg plan §8.3): the
`WorkSurface` **registry-dispatch proposed below never shipped and will not be built**.
The shipped `WorkSurface` switches on `tab.kind`/`resourceKind` and each stage
self-acquires its runtime (`DocumentStage` → `acquireDocument`); the registry earns its
keep for runtime **lifecycle** (per-kind `registerResourceKind`, acquire/dispose,
`active()` for siblings like the Quarterback), not for stage dispatch. Sections below
that show `<DocumentStage runtime={...}>` or `resourceRegistry.active()` inside
`WorkSurface` describe the unshipped variant — read them as history, not intent.

## The problem

The codebase has working pieces — workspace state, tab management, document runtimes,
panel contributions — but they don't connect. The AI Quarterback can't find the current
document. Panels don't know which resource's editor they belong to. Stages load
project data redundantly instead of reading from a shared project context.

The fix is not more imports. It's a **runtime object model** where each scope of the
application owns its state in a single object, and sibling systems coordinate by
reading the active runtime rather than importing from each other.

## Invariants (hard)

1. **Data isolation at every boundary.** A runtime at layer N only exposes data scoped
   to that layer. Layer N+1 cannot reach into another instance of layer N. The
   workspace subscriber pattern (flush on switch) enforces this mechanically.

2. **One publisher per runtime.** Only one attached view owns the publication rights
   for a runtime's session/surface stores. Detach releases them. This prevents races.

3. **Tabs are the source of truth for what is open.** A resource tab references its
   resource by id. The runtime registry derives its active set from the tab set.
   Closing a tab disposes its runtime.

4. **Runtimes are view-independent.** A runtime keeps syncing whether a stage/view is
   mounted or not. Tab switches preserve state because the runtime outlives the
   component.

## The three runtime layers

```
┌────────────────────────────────────────────────────────────┐
│ Session Runtime                                            │
│   owns: user identity, auth state, display name            │
│   lives: sign-in → sign-out (global)                       │
│   isolation: natural — a new session is a new runtime      │
│                                                            │
│   exposes: user: User, signOut(), updateDisplayName()       │
└────────────────────┬───────────────────────────────────────┘
                     │ user selects a project
                     ▼
┌────────────────────────────────────────────────────────────┐
│ Project Runtime                                            │
│   owns: members, resource catalog, activity feed,          │
│         project profile, workspace (tabs + panels)         │
│   lives: project selection → project switch                │
│   isolation: dispose + reinitialize on project change      │
│                                                            │
│   exposes:                                                 │
│     project: Project                                       │
│     members: Member[]                                      │
│     catalog: { items: Resource[], availableKinds[] }       │
│     activity: ActivityEvent[]                              │
│     workspace: Workspace                                   │
│     identity: IdentityResolver (project-scoped profiles)   │
│                                                            │
│   consumed by: OverviewStage, AgentsStage                  │
└────────────────────┬───────────────────────────────────────┘
                     │ user opens a resource tab
                     ▼
┌────────────────────────────────────────────────────────────┐
│ Resource Registry                                          │
│   owns: Map<resourceId, ResourceRuntime> per kind           │
│   lives: project lifetime (flushed on project switch)      │
│   isolation: keyed by projectId + resourceId               │
│                                                            │
│   exposes:                                                 │
│     acquire(kind, projectId, resourceId) → ResourceRuntime │
│     active() → ResourceRuntime | null                      │
│     register(kind, factory) → void                          │
│                                                            │
│   consumed by: WorkSurface (dispatch), QuarterbackDock     │
└────────────────────┬───────────────────────────────────────┘
                     │ registry dispatches by resource kind
                     ▼
┌────────────────────────────────────────────────────────────┐
│ Resource Runtime (per kind)                                │
│   document: DocumentRuntime                                │
│     owns: EditorState, sync loop, pagination, panel sects  │
│     exposes: getState(), getSelection(), actions{}, info   │
│                                                            │
│   slides: SlidesRuntime (future)                           │
│   sheet: SheetRuntime (future)                             │
│   chat: ChatRuntime (future)                               │
│                                                            │
│   consumed by: stage (view), panels (read), QB (read)      │
└────────────────────────────────────────────────────────────┘
```

## How siblings coordinate

The Quarterback dock needs to know the current document. Panels need to know which
editor sections to show. Neither should import from the document stage directly.

Instead they query the **active resource runtime**:

```ts
// Any system that needs to know "what resource am I operating on?"

const runtime = resourceRegistry.active();  // ResourceRuntime | null

if (runtime?.kind === 'document') {
  const doc = runtime as DocumentRuntime;
  const content = doc.getState();
  const selection = doc.getSelection();
  // resolve context sources, populate QB panel, etc.
}
```

The flow:

```
QuarterbackDock
  │  resourceRegistry.active() → DocumentRuntime | null
  │
  ├─► getState()       → document content for "Document" context source
  ├─► getSelection()   → selected text for "Current selection" context source
  └─► info             → save status, document title for QB header

Inspector panels (right rail)
  │  resourceRegistry.active() → current resource runtime
  │
  └─► runtime publishes panel sections via activeSurface
      ├─► InfoPanel       (reads runtime.info, runtime.getState())
      ├─► SearchPanel     (reads runtime.getState())
      ├─► OutlinePanel    (reads runtime.getOutline())
      └─► DetailsPanel    (reads runtime.getSelectionInfo())

Context panels (left rail)
  │  activeSurface.context → current sections
  │
  └─► runtime publishes context sections via activeSurface
      ├─► CommentsPanel   (reads from document context)
      ├─► HistoryPanel    (reads from document context)
      ├─► AiTasksPanel    (reads from document context)
      └─► NameManagerPanel (reads from document context)
```

The key insight: panels and the QB don't import the document stage — they import the
**resource registry**. The registry is the neutral ground where siblings meet.

## The resource registry

Each resource kind registers a factory. The registry dispatches `acquire()` by kind.

```ts
// systems/resources/registry.ts

type ResourceRuntime = DocumentRuntime | SlidesRuntime | SheetRuntime | ChatRuntime;

type ResourceRuntimeFactory = (
  projectId: string,
  resourceId: string,
  title: string
) => ResourceRuntime;

const factories = new Map<ResourceKind, ResourceRuntimeFactory>();
const runtimes = new Map<string, ResourceRuntime>();

export function registerResourceKind(
  kind: ResourceKind,
  factory: ResourceRuntimeFactory
): void;

export function acquire(
  kind: ResourceKind,
  projectId: string,
  resourceId: string,
  title: string
): ResourceRuntime;

export function active(): ResourceRuntime | null;
export function get(key: string): ResourceRuntime | undefined;

// Workspace subscriber: dispose runtimes when tabs close or project changes.
```

Registration happens once at app start:

```ts
// In document system initialization:
import { registerResourceKind } from '$systems/resources/registry';
import { createDocumentRuntime } from './runtime';

registerResourceKind('document', (projectId, resourceId, title) =>
  createDocumentRuntime(projectId, resourceId, title)
);
```

`WorkSurface.svelte` becomes simpler — it asks the registry for the active resource
runtime and dispatches the stage component by kind:

```ts
// WorkSurface.svelte (simplified)

const runtime = $derived(resourceRegistry.active());

// Document tab → DocumentStage
{#if tab?.kind === 'resource' && runtime?.kind === 'document'}
  <DocumentStage runtime={runtime} />
```

> **Not shipped — decided against (2026-07-27, reorg plan §8.3).** The real
> `WorkSurface` keeps its `tab.kind`/`resourceKind` switch and passes
> `{projectId, title, resourceId}`; each stage acquires its own runtime from the
> registry (keyed `{#key tab.id}` so tab switches detach/re-attach cleanly). The
> switch is small, explicit, and adding a stage means adding a branch — acceptable
> shell knowledge, unlike the per-feature panel wiring the panel-system design
> removed. Dispatch-by-registry added indirection without removing a real coupling.

## Mapping to the existing code

| Concept | Current location | Proposed location |
|---|---|---|
| Session Runtime | `data/session.ts` (`session` store) | `systems/session/runtime.ts` (class wrapping the store) |
| Project Runtime | Ad-hoc: `projects` store + `enterProjectResources` + workspace subscriber | `services/project-runtime.ts` (single object, subscribers for isolation) |
| Resource Registry | Private Map in `runtime.ts:1002`, `acquireDocument()` | `systems/resources/registry.ts` (public, per-kind registration, active query) |
| Document Runtime | `runtime.ts` (`DocumentRuntime` class) | `systems/documents/runtime.ts` (annotated, exported for external read) |
| Tab Manager | `data/workspace.ts` (standalone, clean) | `systems/workspace/` (unchanged — already correct) |
| Panel Contributions | `features/shared/surface.ts` (`activeSurface` store) | `features/shared/surface.ts` (unchanged — already correct) |

## What changes from the 2026-07-21 model

The 2026-07-21 model got the per-family runtime manager right but treated it as a
private implementation detail of the document feature. This design makes it a
first-class system:

1. The registry is **public and queryable** — any sibling can find the active runtime.
2. **Per-kind registration** replaces hardcoded `acquireDocument()`. The registry
   doesn't know about documents — it knows about kinds, and each kind's system
   registers its own factory.
3. The **Project Runtime** formalizes what is currently a scattered set of ad-hoc
   `enterProjectResources()` calls. It gives the Overview stage (and future stages) a
   single read point for project data.
4. The **Session Runtime** formalizes session management, giving the identity service
   a single place to resolve "who is the current user?"

## Deliberate non-goals

- **No generic cross-resource events.** The registry exposes `active()` — that's the
  coordination primitive. If two sibling systems need to coordinate in a way that
  `active()` doesn't cover, they go through a service, not the registry.
- **No resource registry persistence.** Runtimes are memory-only. Tabs persist via
  workspace localStorage; the registry rebuilds from the tab set on project enter.
- **No LRU of closed resources.** Closing a tab disposes its runtime. Reopening
  reloads from Omega. The server is the source of truth.
