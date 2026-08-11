import { get, writable } from 'svelte/store';
import { isApiError } from '$data/api';
import { getWorkspaceState, putWorkspaceState } from '$systems/workspace-state';

/**
 * Per-project workspace shell state: open tabs and the two side panels.
 *
 * Strict project isolation (design law): all state is namespaced by project id
 * and never shared across projects. It persists to localStorage under a
 * per-project key so a project reopens how you left it, but one project's shell
 * never bleeds into another's.
 */
// kind distinguishes a blank launcher tab (the "+" → new-tab page) from a resource
// tab. Permanent tabs (overview) are routed by id, so kind is optional there.
// resourceId is the bridge to the open-resource registry: a resource tab REFERENCES
// its resource; the resource's runtime object lives with its manager (e.g. the
// documents manager), not on the tab. Serializable ids only — workspace-ready.
export type Tab = {
  id: string;
  title: string;
  closeable: boolean;
  kind?: 'new' | 'resource';
  resourceId?: string;
  /** Canonical family kind when a caller knows it without consulting the catalog. */
  resourceKind?: 'document' | 'spreadsheet' | 'slides' | 'chat' | 'general';
};
export type PanelState = { width: number; collapsed: boolean; section: string };
export type Workspace = {
  projectId: string;
  tabs: Tab[];
  activeTabId: string;
  context: PanelState;
  inspector: PanelState;
};

// Both panels share the same max, and default to the narrow "smallest-before-
// collapse" width so they hug the side until dragged wider.
export const CONTEXT_MIN = 220;
export const CONTEXT_MAX = 440;
export const CONTEXT_DEFAULT = 220;
export const INSPECTOR_MIN = 220;
export const INSPECTOR_MAX = 440;
export const INSPECTOR_DEFAULT = 220;

// Permanent destinations — always present, not closeable. Agents used to be the
// second one; it was promoted to the user-scoped /library/agents route
// (2026-07-29), since agents span projects and a tab cannot. `normalize()`
// rebuilds permanents from this set, so persisted 'agents' tabs disappear on
// their own and a persisted activeTabId of 'agents' falls back to overview.
const PERMANENT: Tab[] = [{ id: 'overview', title: 'Overview', closeable: false }];

function defaults(projectId: string): Workspace {
  return {
    projectId,
    tabs: PERMANENT.map((t) => ({ ...t })),
    activeTabId: 'overview',
    context: { width: CONTEXT_DEFAULT, collapsed: false, section: 'properties' },
    inspector: { width: INSPECTOR_DEFAULT, collapsed: false, section: 'details' }
  };
}

const keyFor = (id: string) => `taurus.ws.${id}`;

// Rebuild a full Workspace from a saved (partial) one: rebuild permanent destinations
// from the current set (so renames apply), keep saved resource tabs, and validate the
// active tab still exists. Shared by the localStorage load and the server hydrate.
function normalize(projectId: string, saved: Partial<Workspace>): Workspace {
  const closeable = (saved.tabs ?? []).filter((t) => t.closeable);
  const tabs = [...PERMANENT.map((t) => ({ ...t })), ...closeable];
  const activeTabId = tabs.some((t) => t.id === saved.activeTabId) ? saved.activeTabId! : 'overview';
  return { ...defaults(projectId), ...saved, projectId, tabs, activeTabId };
}

function load(projectId: string): Workspace {
  if (typeof localStorage === 'undefined') return defaults(projectId);
  try {
    const raw = localStorage.getItem(keyFor(projectId));
    if (!raw) return defaults(projectId);
    return normalize(projectId, JSON.parse(raw) as Partial<Workspace>);
  } catch {
    return defaults(projectId);
  }
}

/** Null until a project is entered. */
export const workspace = writable<Workspace | null>(null);

/** Load (and isolate to) a project's workspace. Call when the project changes. */
export function enterProject(projectId: string): void {
  workspace.set(load(projectId));
  void hydrateFromServer(projectId);
}

function persist(ws: Workspace) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(keyFor(ws.projectId), JSON.stringify(ws));
}

function mutate(fn: (ws: Workspace) => Workspace) {
  workspace.update((ws) => {
    if (!ws) return ws;
    const next = fn(ws);
    persist(next);
    schedulePush(next);
    return next;
  });
}

// --- cross-device sync (per-user workspace state; Omega Workspaces capability) -------
// Best-effort: hydrate from the server on enter, push (debounced) on change. localStorage
// stays the fast local mirror; if the capability is absent (404), fall back to local-only
// for the rest of the session.
let serverUnavailable = false;

async function hydrateFromServer(projectId: string): Promise<void> {
  if (serverUnavailable) return;
  try {
    const state = await getWorkspaceState();
    // Apply only if the server had state AND we're still on this project (a fast switch
    // could have moved on before the fetch resolved).
    if (state && get(workspace)?.projectId === projectId) {
      const next = normalize(projectId, state as Partial<Workspace>);
      persist(next); // mirror to localStorage; workspace.set does not re-push
      workspace.set(next);
    }
  } catch (e) {
    if (isApiError(e) && e.status === 404) serverUnavailable = true;
    // Other (transient) errors leave the localStorage version in place.
  }
}

let pushTimer: ReturnType<typeof setTimeout> | undefined;
let pushProjectId: string | null = null;

function schedulePush(ws: Workspace): void {
  if (serverUnavailable) return;
  pushProjectId = ws.projectId;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void flushPush(), 700);
}

async function flushPush(): Promise<void> {
  const ws = get(workspace);
  // Only push while still on the project that changed: a switch resets the store's
  // projectId, so a stale timer is skipped rather than written to the newly-selected
  // project (Omega keys workspace state by the session's selected project).
  if (serverUnavailable || !ws || ws.projectId !== pushProjectId) return;
  try {
    await putWorkspaceState(ws);
  } catch (e) {
    if (isApiError(e) && e.status === 404) serverUnavailable = true;
  }
}

// One tab per resource: the tab already showing this resource, if any. Matched by
// resource id when both sides have one, else by title for old persisted tabs that
// predate canonical resource ids.
function resourceTab(ws: Workspace, title: string, resourceId?: string): Tab | undefined {
  return ws.tabs.find(
    (t) =>
      t.kind === 'resource' &&
      (resourceId && t.resourceId ? t.resourceId === resourceId : t.title === title)
  );
}

/**
 * Open a closeable tab. With a title it's a resource tab (pass the resource's id so
 * the tab references its registry entry); with no title it's a blank "new" tab that
 * renders the new-tab launcher (the "+").
 *
 * One tab per resource: opening a resource that's already open re-routes to its
 * existing tab instead of duplicating it — an editor is linked to its resource.
 */
export function openTab(title?: string, resourceId?: string, resourceKind?: Tab['resourceKind']): void {
  mutate((ws) => {
    if (title) {
      const existing = resourceTab(ws, title, resourceId);
      if (existing) return { ...ws, activeTabId: existing.id };
    }
    const id = 'tab_' + Math.random().toString(36).slice(2, 8);
    const tab: Tab = title
      ? { id, title, closeable: true, kind: 'resource', ...(resourceId ? { resourceId } : {}), ...(resourceKind ? { resourceKind } : {}) }
      : { id, title: 'New tab', closeable: true, kind: 'new' };
    return { ...ws, tabs: [...ws.tabs, tab], activeTabId: id };
  });
}

/**
 * Resolve a blank "new" tab into a resource tab in place — the launcher picks a
 * resource (recent, created, template, or AI), and the tab becomes it (browser-style).
 * If the resource is already open in another tab, the launcher tab closes and that
 * tab activates instead (one tab per resource).
 */
export function resolveTab(id: string, title: string, resourceId?: string, resourceKind?: Tab['resourceKind']): void {
  mutate((ws) => {
    const existing = resourceTab(ws, title, resourceId);
    if (existing && existing.id !== id) {
      return { ...ws, tabs: ws.tabs.filter((t) => t.id !== id), activeTabId: existing.id };
    }
    return {
      ...ws,
      tabs: ws.tabs.map((t) =>
        t.id === id
          ? { ...t, title, kind: 'resource' as const, ...(resourceId ? { resourceId } : {}), ...(resourceKind ? { resourceKind } : {}) }
          : t
      ),
      activeTabId: id
    };
  });
}

/** Keep an open resource tab's persisted title aligned with a canonical rename. */
export function renameResourceTab(resourceId: string, title: string): void {
  mutate((ws) => ({
    ...ws,
    tabs: ws.tabs.map((tab) => (tab.resourceId === resourceId ? { ...tab, title } : tab))
  }));
}

export function activateTab(id: string): void {
  mutate((ws) => ({ ...ws, activeTabId: id }));
}

export function closeTab(id: string): void {
  mutate((ws) => {
    const idx = ws.tabs.findIndex((t) => t.id === id);
    if (idx < 0 || !ws.tabs[idx].closeable) return ws;
    const tabs = ws.tabs.filter((t) => t.id !== id);
    let activeTabId = ws.activeTabId;
    if (activeTabId === id) {
      // Move to the nearest remaining resource tab; default to Overview otherwise.
      const prev = ws.tabs.slice(0, idx).reverse().find((t) => t.closeable);
      const next = ws.tabs.slice(idx + 1).find((t) => t.closeable);
      activeTabId = (prev ?? next)?.id ?? 'overview';
    }
    return { ...ws, tabs, activeTabId };
  });
}

/** Close every other closeable tab, keeping this one (and the permanent ones). */
export function closeOthers(id: string): void {
  mutate((ws) => ({
    ...ws,
    tabs: ws.tabs.filter((t) => !t.closeable || t.id === id),
    activeTabId: id
  }));
}

/** Close the closeable tabs positioned after this one. */
export function closeRight(id: string): void {
  mutate((ws) => {
    const idx = ws.tabs.findIndex((t) => t.id === id);
    if (idx < 0) return ws;
    const tabs = ws.tabs.filter((t, i) => i <= idx || !t.closeable);
    const activeTabId = tabs.some((t) => t.id === ws.activeTabId) ? ws.activeTabId : id;
    return { ...ws, tabs, activeTabId };
  });
}

/** Reorder: move a tab to another tab's position (drag-and-drop). */
export function moveTab(fromId: string, toId: string): void {
  mutate((ws) => {
    const from = ws.tabs.findIndex((t) => t.id === fromId);
    const to = ws.tabs.findIndex((t) => t.id === toId);
    if (from < 0 || to < 0 || from === to || !ws.tabs[from].closeable || !ws.tabs[to].closeable) return ws;
    const tabs = [...ws.tabs];
    const [moved] = tabs.splice(from, 1);
    tabs.splice(to, 0, moved);
    return { ...ws, tabs };
  });
}

/** Reorder a group of tabs (preserving their order) to another tab's position. */
export function moveTabs(ids: string[], toId: string): void {
  mutate((ws) => {
    const idset = new Set(ids.filter((id) => ws.tabs.find((t) => t.id === id)?.closeable));
    if (idset.size === 0 || idset.has(toId)) return ws;
    const moving = ws.tabs.filter((t) => idset.has(t.id));
    const rest = ws.tabs.filter((t) => !idset.has(t.id));
    const idx = rest.findIndex((t) => t.id === toId);
    if (idx < 0) return ws;
    return { ...ws, tabs: [...rest.slice(0, idx), ...moving, ...rest.slice(idx)] };
  });
}

export function setPanel(key: 'context' | 'inspector', patch: Partial<PanelState>): void {
  mutate((ws) => ({ ...ws, [key]: { ...ws[key], ...patch } }));
}
