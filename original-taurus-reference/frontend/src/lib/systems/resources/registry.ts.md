# src/lib/systems/resources/registry.ts — breakdown

Companion to [registry.ts](registry.ts). The per-kind runtime registry: each resource kind registers a runtime **factory** at app init, and `acquire` dispatches to the right factory (memoizing one runtime per open resource) so a workspace tab can open that kind's editor. A workspace subscriber tracks which resources are open and disposes runtimes when their tab closes or the project changes, keeping runtime lifetime tied to the shell without the shell knowing anything about concrete per-kind runtimes.

## Imports and registry overview

### Import the workspace store and types, and document the registry's contract

```ts
import { get } from 'svelte/store';
import { workspace } from '$data/workspace';
import type { ResourceKind } from './types';

// Resource Registry — per-kind runtime factories.
// Each resource kind registers a factory at app init. The registry dispatches
// acquire(kind, projectId, resourceId) by looking up the factory. A workspace
// subscriber disposes runtimes when their tab closes or the project changes.

```

The registry reads the `workspace` store both reactively (via `subscribe`, for disposal) and imperatively (via `get`, in `active()`). `ResourceKind` keys the factory table. The header comment states the whole contract — register factories, dispatch by kind, dispose on tab/project change — so the module is self-describing. The trailing blank line separates the overview from the type declarations.

## Runtime types

### The Disposable contract, the runtime alias, and the factory signature

```ts
interface Disposable {
  dispose(): void;
}

export type ResourceRuntime = Disposable;

type RuntimeFactory = (
  projectId: string,
  resourceId: string,
  title: string,
  key: string
) => ResourceRuntime;

```

`Disposable` is the minimal lifecycle contract every runtime must satisfy — a single `dispose()` the registry calls on teardown. `ResourceRuntime` is exported as the public alias so kind modules type their runtimes against it without importing `Disposable`. `RuntimeFactory` is what each kind registers: given the project id, resource id, a display `title`, and the precomputed cache `key`, it builds a runtime. The trailing blank line separates the types from the module state.

## Module state

### The factory table and the live-runtime cache

```ts
const factories = new Map<string, RuntimeFactory>();
const runtimes = new Map<string, ResourceRuntime>();

```

Two module-level maps hold all registry state. `factories` maps a kind id to its registered factory (populated once at init). `runtimes` is the live cache, keyed by `projectId:resourceId`, so opening the same resource twice reuses one runtime rather than constructing a duplicate. The trailing blank line separates the state from the key helper.

## Runtime key helper

### Compose the composite cache key for a runtime

```ts
function runtimeKey(projectId: string, resourceId: string): string {
  return `${projectId}:${resourceId}`;
}

```

`runtimeKey` is the single source of the cache-key format, combining project and resource ids so runtimes are namespaced per project. Centralizing it means `acquire`, `active`, and the disposal subscriber all agree on the exact key shape. The trailing blank line separates it from the registration function.

## Registering a kind's factory

### Record the factory for a resource kind

```ts
export function registerResourceKind(
  kind: ResourceKind,
  factory: RuntimeFactory
): void {
  factories.set(kind, factory);
}

```

`registerResourceKind` is the registration side of the registry: each kind module calls it at app init to publish how its runtime is built. This is what decouples the shell from concrete runtimes — the registry only ever knows the `ResourceKind` and the factory, never the runtime's implementation. The trailing blank line separates it from `acquire`.

## Acquiring (or creating) a runtime

### Return the cached runtime for a resource, constructing it on first use

```ts
export function acquire(
  kind: ResourceKind,
  projectId: string,
  resourceId: string,
  title: string
): ResourceRuntime {
  const key = runtimeKey(projectId, resourceId);
  let rt = runtimes.get(key);
  if (!rt) {
    const factory = factories.get(kind);
    if (!factory) throw new Error(`No runtime factory registered for resource kind: ${kind}`);
    rt = factory(projectId, resourceId, title, key);
    runtimes.set(key, rt);
  }
  return rt;
}

```

`acquire` is the dispatch side. It computes the cache key and returns an existing runtime if one is live; otherwise it looks up the kind's factory, builds the runtime, and caches it. A missing factory throws loudly rather than returning `undefined`, since it means a kind was opened before its module registered — a wiring bug worth surfacing. The trailing blank line separates it from `active`.

## The active runtime

### Resolve the runtime for the currently active resource tab

```ts
/** The runtime for the active resource tab, or null if no resource is active. */
export function active(): ResourceRuntime | null {
  const ws = get(workspace);
  if (!ws) return null;
  const tab = ws.tabs.find((t) => t.id === ws.activeTabId);
  if (!tab || tab.kind !== 'resource' || !tab.resourceId) return null;
  const key = runtimeKey(ws.projectId, tab.resourceId);
  return runtimes.get(key) ?? null;
}

```

`active` is a convenience for UI that acts on "whatever resource is focused now": it reads the workspace snapshot, finds the active tab, and returns its cached runtime — or `null` when there is no workspace, the active tab is not a resource, or no runtime has been acquired yet. It only ever reads the cache; it never constructs, so a component asking for the active runtime cannot accidentally create one. The trailing blank line separates it from `getRuntime`.

## Lookup by key

### Fetch a runtime directly by its cache key

```ts
export function getRuntime(key: string): ResourceRuntime | undefined {
  return runtimes.get(key);
}

```

`getRuntime` exposes the cache to callers that already hold a `key` (the same `key` a factory received at construction), letting a runtime's own collaborators find it without re-deriving the composite key. It returns `undefined` when nothing is cached. The trailing blank line separates it from the lifecycle section.

## Lifecycle: workspace subscriber

### Dispose runtimes on teardown, project switch, or tab close

```ts
// --- lifecycle: workspace subscriber for disposal and isolation ----------------

let watchedProject: string | null = null;
workspace.subscribe((ws) => {
  if (!ws) {
    for (const rt of runtimes.values()) rt.dispose();
    runtimes.clear();
    watchedProject = null;
    return;
  }
  if (watchedProject !== ws.projectId) {
    for (const rt of runtimes.values()) rt.dispose();
    runtimes.clear();
    watchedProject = ws.projectId;
    return;
  }
  const open = new Set(
    ws.tabs
      .filter((t) => t.kind === 'resource' && t.resourceId)
      .map((t) => runtimeKey(ws.projectId, t.resourceId!))
  );
  for (const [key, rt] of [...runtimes]) {
    if (!open.has(key)) {
      rt.dispose();
      runtimes.delete(key);
    }
  }
});
```

This standing subscription enforces runtime lifetime against the workspace. When the workspace clears (sign-out), every runtime is disposed and the cache emptied. When the project changes, all runtimes are disposed for isolation — a new project must not see the previous one's runtimes — and `watchedProject` advances. Otherwise it reconciles the cache against the set of currently open resource tabs, disposing and deleting any runtime whose tab has closed. Iterating over a `[...runtimes]` copy makes deleting entries mid-loop safe, and the non-null assertion on `t.resourceId` is justified by the preceding filter.
