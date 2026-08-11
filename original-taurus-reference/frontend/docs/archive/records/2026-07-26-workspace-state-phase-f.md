# 2026-07-26 — Phase F: per-user workspace state (cross-device tabs + panels)

The workspace shell (open tabs, panel geometry/sections) persisted only to `localStorage`, so
it didn't follow the user across devices. Omega now offers a per-user, per-project workspace
store; this wires the cockpit to it, best-effort, with localStorage as the fast local mirror.

Contract (verified against Omega source): `GET /workspace` returns the saved state **spread at
the top level** plus `updatedAt` (`{ "updatedAt": null }` when nothing is saved);
`PUT /workspace` takes the whole state as an **opaque JSON object** (≤64 KiB). Keyed by user ×
the session's **selected project** (no project id in the request). Gated by `opts.Workspaces` —
**404 when absent**.

## Client (new `systems/workspace-state`)

```ts
export async function getWorkspaceState(): Promise<WorkspaceStatePayload | null> {
  const res = await api<Record<string, unknown>>('/workspace');
  if (!res || res.updatedAt == null) return null;   // nothing saved
  const state = { ...res }; delete state.updatedAt; return state;
}
export async function putWorkspaceState(state: WorkspaceStatePayload): Promise<void> {
  await api('/workspace', { method: 'PUT', body: JSON.stringify(state) });
}
```

The state is opaque to Omega, so the client just strips the server-injected `updatedAt` on read
and PUTs the whole workspace object on write.

## Sync wiring in `data/workspace.ts`

```ts
export function enterProject(projectId: string): void {
  workspace.set(load(projectId));        // localStorage first (no flash)
  void hydrateFromServer(projectId);     // then apply the server copy if present
}
function mutate(fn) { workspace.update((ws) => { … persist(next); schedulePush(next); return next; }); }
```

`load`'s rebuild logic was extracted into a shared `normalize(projectId, saved)` so the server
hydrate reuses the exact same permanent-tab rebuild + active-tab validation. On enter, the local
copy shows immediately and `hydrateFromServer` overlays the server copy (guarded on *still being
on this project*). On change, `schedulePush` debounces a `PUT` (700 ms).

### The guarded push (avoids cross-project misroute)

```ts
async function flushPush() {
  const ws = get(workspace);
  // Omega keys by the session's selected project; a switch resets the store's projectId,
  // so a stale timer is skipped rather than written to the newly-selected project.
  if (serverUnavailable || !ws || ws.projectId !== pushProjectId) return;
  try { await putWorkspaceState(ws); } catch (e) { if (isApiError(e) && e.status === 404) serverUnavailable = true; }
}
```

Because routes call `openProject` (session-select) *before* the shell's `enterProject`, a
debounced push after a project switch could otherwise write the old project's state to the new
project's session. The `projectId` guard skips a stale timer instead — the only cost is losing
the last <700 ms of changes on a rapid switch (documented, minor). A **404** on GET or PUT flips
`serverUnavailable`, and the session degrades to localStorage-only — "nothing hidden": the
feature simply falls back rather than erroring.

## Verification

- `pnpm check` 0/0; `pnpm test` **279** (+3: null-when-unsaved, strip-`updatedAt`, PUT body).
- Contract matched to Omega source (opaque object, `updatedAt` semantics, `opts.Workspaces` 404).
- Companions: 2 new + `data/workspace.ts` updated, all byte-verified.
- Live UI E2E pending (no headless Chrome): open tabs / drag a panel, reload → state restores
  from the server; on a server without the capability, it silently uses localStorage.
