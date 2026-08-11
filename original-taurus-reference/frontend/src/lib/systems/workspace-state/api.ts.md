# src/lib/systems/workspace-state/api.ts — breakdown

Companion to [api.ts](api.ts). The per-user workspace-state client for Omega's
Workspaces capability: `getWorkspaceState`/`putWorkspaceState` read and write an
**opaque JSON** blob at `GET`/`PUT /workspace`, keyed by user × the session's
selected project, and surface a 404 so the caller can fall back to local-only.

## Module doc and payload type

### The api import, the capability's contract, and the opaque state type

```ts
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

```

The module rides on the shared `api` client, inheriting its base URL, auth, and
`ApiError` handling. The doc comment fixes the contract: Omega persists the cockpit
shell as an opaque JSON object keyed by user × the session's selected project, echoes
it back spread at the top level with an added `updatedAt`, and gates the routes on the
`Workspaces` capability so an unconfigured server answers 404. `WorkspaceStatePayload`
is deliberately a bare `Record<string, unknown>` — the shape (tabs + panel geometry)
is the client's business; Omega only stores and returns the bytes.

## Reading saved state

### GET /workspace, strip the server-injected updatedAt, and return null when nothing is saved

```ts
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

```

`getWorkspaceState` GETs `/workspace` and normalizes the "nothing saved" case: Omega
signals it with `{ "updatedAt": null }`, so a missing response or a null `updatedAt`
both collapse to `null`. Otherwise it copies the object and deletes the server-injected
`updatedAt`, handing back only the caller's own payload. Errors are not swallowed — a
404 (capability unconfigured) or 400 (no project selected) surfaces as an `ApiError`
for the caller (the workspace store) to branch on.

## Writing state

### PUT the whole state to /workspace

```ts
/** Persist the whole workspace state for the selected project (Omega caps it at 64 KiB). */
export async function putWorkspaceState(state: WorkspaceStatePayload): Promise<void> {
  await api('/workspace', { method: 'PUT', body: JSON.stringify(state) });
}
```

`putWorkspaceState` serializes the entire payload and PUTs it to `/workspace` — a
whole-object replace, not a patch, keyed to the session's selected project. Omega caps
the stored blob at 64 KiB. The call resolves to `void`; any failure (including a 404
when the capability is off) propagates as an `ApiError` for the caller to handle.
