import { api } from '$data/api';

/**
 * Per-user workspace-state client (Omega Workspaces capability). Omega stores the
 * cockpit's shell state as an **opaque JSON object**, keyed by user × selected
 * project (the project comes from the session, not the request), and returns it
 * spread at the top level with an added `updatedAt`. The routes are gated on
 * `opts.Workspaces`, so a server without the capability returns 404 — callers treat
 * that as "fall back to local-only".
 */

/** The client-defined shell state (tabs + panel geometry). Opaque to Omega. */
export type WorkspaceStatePayload = Record<string, unknown>;

/**
 * The caller's saved workspace state for the selected project, or `null` when none is
 * saved (`{ "updatedAt": null }`). Throws an `ApiError` (404 when the capability is
 * unconfigured; 400 when no project is selected) for the caller to handle.
 */
export async function getWorkspaceState(): Promise<WorkspaceStatePayload | null> {
  const res = await api<Record<string, unknown>>('/workspace');
  if (!res || res.updatedAt == null) return null;
  const state = { ...res };
  delete state.updatedAt;
  return state;
}

/** Persist the whole workspace state for the selected project (Omega caps it at 64 KiB). */
export async function putWorkspaceState(state: WorkspaceStatePayload): Promise<void> {
  await api('/workspace', { method: 'PUT', body: JSON.stringify(state) });
}
