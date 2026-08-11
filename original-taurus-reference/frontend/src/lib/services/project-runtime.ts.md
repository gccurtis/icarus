# src/lib/services/project-runtime.ts — breakdown

Companion to [project-runtime.ts](project-runtime.ts). The Project Runtime is the
single read point for all project-scoped data — members, resource catalog, and
activity feed — aggregated into one object. A workspace subscriber enforces strict
project isolation by flushing on every project switch.

## Imports

### Stores and loaders from the data layer

```ts
import { get, writable } from 'svelte/store';
import { api, isApiError } from '$data/api';
import { projects, fetchProjects, openProject, currentUserId, type Project, type Member } from '$data/projects';
import { resources, availableKinds, enterProjectResources, type Resource } from '$data/resources';
import { loadActivityPage, type ActivityEvent } from '$data/projects';
import { fetchMembers } from '$data/projects';
import { workspace } from '$data/workspace';

```

The runtime is an aggregator, so it pulls from every project-scoped data module: the
`projects` store and its loaders, the `resources` catalog, the activity-page loader from
`overview`, and the `workspace` store that drives project selection. `get` and `writable`
are the Svelte store primitives it uses to read snapshots and expose its own state.

## ProjectContext

### The module's intent and the aggregated context shape

```ts
/**
 * Project Runtime — the single read point for all project-scoped data.
 *
 * When a project is selected, this runtime aggregates the project's members,
 * resource catalog, and activity feed into one object. Stages read from it
 * instead of independently calling load functions. A workspace subscriber
 * flushes all data on project switch — strict isolation.
 *
 * This is additive (Phase 1): it wraps existing stores and API calls without
 * changing their behavior. Adoption in Phase 5 replaces ad-hoc load calls.
 */
export type ProjectContext = {
  projectId: string;
  project: Project | null;
  members: Member[];
  catalog: Resource[];
  activity: ActivityEvent[];
  activityCursor: string | null;
  loading: boolean;
  error: string;
};

```

The doc comment frames the runtime as additive Phase-1 scaffolding: it wraps existing
stores without changing them, to be adopted in Phase 5. `ProjectContext` is the single
object it exposes — the project itself plus its `members`, resource `catalog`, and
`activity` feed (with an `activityCursor` for pagination), alongside `loading`/`error`
status so a consuming stage can render every state from one value.

## Defaults and the store

### The empty-context factory and the public writable

```ts
const defaults = (projectId: string): ProjectContext => ({
  projectId,
  project: null,
  members: [],
  catalog: [],
  activity: [],
  activityCursor: null,
  loading: false,
  error: ''
});

/** The selected project's aggregated runtime state. */
export const projectContext = writable<ProjectContext | null>(null);

```

`defaults` builds a fresh, empty `ProjectContext` for a given project id — the starting
point every load resets to, which is also what enforces isolation (no data leaks across
projects). `projectContext` is the exported writable stages subscribe to; it is `null`
until a project is entered.

## enterProject

### Load and isolate all data for one project

```ts
/** Load (and isolate to) a project. Call when the workspace project changes. */
export async function enterProject(projectId: string): Promise<void> {
  const ctx = defaults(projectId);
  projectContext.set({ ...ctx, loading: true });

  try {
    await fetchProjects();
    const project = get(projects).find((p) => p.id === projectId) ?? null;
    ctx.project = project;

    try {
      await enterProjectResources(projectId);
      ctx.catalog = get(resources);
      ctx.activity = [];
      ctx.activityCursor = null;
    } catch {
      // resource catalog is non-fatal — Overview reads it for the table
    }

    const page = await loadActivityPage(projectId);
    ctx.activity = page.events;
    ctx.activityCursor = page.nextCursor;

    try {
      ctx.members = await fetchMembers(projectId);
    } catch {
      // member list is non-fatal — project header shows name only
    }
  } catch (e) {
    ctx.error = isApiError(e) ? e.message : 'Could not load the project.';
  } finally {
    ctx.loading = false;
  }

  projectContext.set({ ...ctx });
}

```

`enterProject` starts from a fresh `defaults` context flagged `loading`, then fills it
in stages. The resource catalog and member list are each wrapped in their own try/catch
so a failure in either is non-fatal — the runtime degrades to a partial context rather
than failing the whole load. Only an outer failure sets `error`. It commits the store
once at the start (to show loading) and once at the end (with the final context), and a
`finally` guarantees `loading` is cleared. Stages that currently call
`enterProjectResources()` independently will instead read `$projectContext` in Phase 5.

## Isolation subscriber

### Flush and reload whenever the workspace project changes

```ts
// Strict isolation: flush on project change.
let watchedProject: string | null = null;
workspace.subscribe((ws) => {
  if (!ws) {
    if (watchedProject !== null) {
      projectContext.set(null);
      watchedProject = null;
    }
    return;
  }
  if (watchedProject !== ws.projectId) {
    watchedProject = ws.projectId;
    void enterProject(ws.projectId);
  }
});
```

A module-level `watchedProject` tracks the project currently loaded. The subscriber is
the isolation mechanism: when the workspace clears, it resets the store to `null`; when
it flips to a different project id, it records the new id and kicks off `enterProject`.
Guarding on the id change means a workspace emission that doesn't change the project is
ignored. The same flush-on-switch pattern is used by the document runtime registry
(`runtime.ts:1020`).
