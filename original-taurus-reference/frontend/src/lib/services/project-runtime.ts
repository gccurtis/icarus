import { get, writable } from 'svelte/store';
import { api, isApiError } from '$data/api';
import { projects, fetchProjects, openProject, currentUserId, type Project, type Member } from '$data/projects';
import { resources, availableKinds, enterProjectResources, type Resource } from '$data/resources';
import { loadActivityPage, type ActivityEvent } from '$data/projects';
import { fetchMembers } from '$data/projects';
import { workspace } from '$data/workspace';

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
