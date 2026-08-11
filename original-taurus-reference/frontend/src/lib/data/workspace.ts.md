# src/lib/data/workspace.ts — breakdown

Companion to [workspace.ts](workspace.ts). Per-project shell state — open tabs and
the two side panels — with **strict project isolation** (namespaced by id,
persisted per project).

## Types and constants

### Shape and panel size bounds

```ts
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

```

Alongside `writable`, the module pulls in `get` (to read the store synchronously from
async sync callbacks), `isApiError` (to recognize a 404 capability-off response), and
the `getWorkspaceState`/`putWorkspaceState` client — all feeding the cross-device sync
section below. A `Workspace` carries the tabs, the active tab, and each panel's width,
collapsed flag, and active `section`. A `Tab`'s `kind` marks a blank launcher tab (`'new'`) vs a
`'resource'` tab; its optional `resourceKind` carries canonical family metadata when a
real backend caller already has it. Permanent tabs are routed by id. Both
panels share the same max and default to the narrow minimum width, so they hug their
side until dragged wider.

## Defaults and persistence

### Permanent tabs, per-project key, the shared normalizer, and load

```ts
// Permanent destinations — always present, not closeable.
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

```

`PERMANENT` is the always-present destination set — just Overview since 2026-07-29,
when the Agents tab was promoted to the user-scoped `/library/agents` route (agents
span projects; a tab inside one project's shell could never honestly show them).
`keyFor` namespaces storage by project id (isolation). `normalize` is the shared
rebuild helper — it **rebuilds the permanent tabs from the current `PERMANENT`** (so
removals like Agents, and renames, apply to saved state automatically: a persisted
'agents' tab disappears and a persisted `activeTabId` of `agents` falls back to
overview), keeps any saved resource tabs, and validates the active tab; it is reused
by both the localStorage `load` and the server hydrate below. `load` reads the
per-project key (or seeds `defaults`) and hands the parsed partial to `normalize`.

## Store and enter

### The store and per-project load

```ts
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

```

`workspace` is null until `enterProject` loads a specific project (swapping the
whole state — isolation) and fires a background `hydrateFromServer` to fold in any
cross-device state. `mutate` is the internal helper that applies a change, persists it
under the project's key, and schedules a debounced push to the server.

## Cross-device sync

### Best-effort hydrate on enter and debounced push on change (Omega Workspaces capability)

```ts
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

```

Cross-device sync layers over the localStorage mirror using Omega's Workspaces
capability — best-effort, never blocking. `serverUnavailable` latches once the server
answers 404 (capability off), short-circuiting every path so the session degrades to
local-only. `hydrateFromServer` (fired from `enterProject`) fetches the saved state and
applies it **only if** a fast project switch hasn't moved the store on in the meantime;
it reshapes the opaque payload through the same `normalize` helper and writes via
`persist` + `workspace.set` rather than `mutate`, so hydrating doesn't immediately push
back what it just pulled. On the write side, `mutate` calls `schedulePush`, which
records the changed project and debounces a `flushPush` by 700 ms (coalescing bursts of
edits). `flushPush` reads the live store with `get` and guards against a stale timer:
if the active project no longer matches `pushProjectId` — Omega keys workspace state by
the session's selected project — it skips rather than writing one project's state under
another. Both async paths trip `serverUnavailable` on a 404.

## Actions

### Tabs and panels

```ts
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
```

**One tab per resource** (`resourceTab` is the lookup): a resource is only ever open in
one tab — an editor is linked to its resource. Resource tabs carry the resource's
**`resourceId`** (the bridge into the open-resource registry — the runtime managers key
off it) and may carry **`resourceKind`** from a canonical point read; matching prefers
ids and falls back to titles for old persisted tabs. `openTab`
with an already-open resource **re-routes** to its existing tab; `resolveTab` resolving a
launcher into an already-open resource **closes the launcher** and activates that tab;
otherwise `openTab` appends a closeable tab and activates it (title → `resource`, none →
the blank `new` launcher) and `resolveTab` converts in place (browser-style).
`renameResourceTab` folds a real resource rename into the persisted tab descriptor so
the strip and stage stay aligned. `activateTab` switches; `closeTab` removes a closeable
tab and, if it was active, moves to the nearest remaining resource tab or defaults to **Overview**.
`closeOthers`/`closeRight` back the tab context menu; `moveTab`/`moveTabs` reorder one
tab or a whole selected group (guarded to closeable tabs so permanent destinations stay
put). `setPanel` patches a panel's width/collapsed/section. Every action persists via
`mutate`.
