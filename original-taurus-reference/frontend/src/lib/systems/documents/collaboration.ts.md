# src/lib/systems/documents/collaboration.ts — breakdown

Companion to [collaboration.ts](collaboration.ts). Document-bar collaboration
projection backed by Omega's session system — presence polling,
join/leave/publish, a last-editor lookup from history, and a derived store that
drives the document bar's presence UI.

## Imports

### Core stores, API, session, projects, toast, and history

```ts
import { writable, derived, get } from 'svelte/store';
import { api, isApiError } from '$data/api';
import { session } from '$data/session';
import { projects } from '$data/projects';
import { toast } from '$lib/toast';
import { fetchDocumentHistory } from './api';

```

Standard Svelte store primitives, the API client, the signed-in-user session
store, and the project list store back the derived collaboration projection.
`toast` surfaces a user-visible warning when presence registration fails, and
`fetchDocumentHistory` supplies the newest change's author for last-editor
attribution.

## Module documentation and types

### Collaborator shape, bar projection, and raw Omega session entry

```ts
/**
 * Document-bar collaboration projection backed by Omega's session system.
 *
 * Omega's `GET /sessions` returns active project sessions with user ID, name,
 * and current document ID. We poll it periodically and derive the document bar's
 * open-user list by filtering sessions that are viewing the current document.
 */

export type DocumentCollaborator = {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  access: 'You' | 'Editor' | 'Viewer';
  current: boolean;
  mock: boolean;
};

export type DocumentBarCollaboration = {
  lastEditor: DocumentCollaborator;
  openUsers: DocumentCollaborator[];
};

type SessionEntry = {
  userId: string;
  userName: string;
  currentDocumentId: string;
  startedAt: string;
  lastActivityAt: string;
};

```

`DocumentCollaborator` is the user-facing presence record — it carries identity,
an access label derived from project membership, a `current` flag for the
signed-in user, and a `mock` flag for fallback states. `DocumentBarCollaboration`
wraps a single `lastEditor` and an `openUsers` array. `SessionEntry` is the raw
shape returned by Omega's `GET /sessions`.

## Presence polling

### Session store, active project tracking, and poll lifecycle

```ts
const projectSessions = writable<SessionEntry[]>([]);

let pollTimer: ReturnType<typeof setInterval> | null = null;
export const activeProjectId = writable<string>('');

export function startPresencePolling(projectId: string): void {
  if (pollTimer && get(activeProjectId) === projectId) return;
  stopPresencePolling();
  activeProjectId.set(projectId);
  const poll = () => {
    api<{ sessions: SessionEntry[] }>('/sessions').then(
      (res) => projectSessions.set(res.sessions ?? []),
      () => projectSessions.set([])
    );
  };
  poll();
  pollTimer = setInterval(poll, 30000);
}

export function stopPresencePolling(): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  activeProjectId.set('');
  projectSessions.set([]);
}

```

`projectSessions` holds current session entries from Omega. `activeProjectId` is
a writable store set by polling start/stop so the derived store can react to
project changes. `startPresencePolling` is idempotent for the same project, calls
`GET /sessions` immediately then every 30 seconds, and swallows errors by clearing
the session list. `stopPresencePolling` tears down the timer, resets the active
project ID, and empties the session store.

## Session join / leave / publish

### Register, unregister, and publish presence to Omega

```ts
// --- session join / leave / publish -----------------------------------------

let sessionId: string | null = null;

export async function joinSession(): Promise<void> {
  try {
    const res = await api<{ sessionId: string }>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ sessionId: sessionId ?? '' })
    });
    sessionId = res.sessionId;
  } catch (e) {
    // A 401 means the session itself lapsed — the app-wide expiry watcher is
    // already bouncing to sign-in, so a presence toast would just be noise.
    if (isApiError(e) && e.status === 401) return;
    console.error('joinSession failed', e);
    toast('Presence join failed — session data may be stale', { tone: 'attention' });
  }
}

export async function leaveSession(): Promise<void> {
  if (!sessionId) return;
  try {
    await api('/sessions/current', { method: 'DELETE' });
  } catch (e) {
    console.error('leaveSession failed', e);
  }
  sessionId = null;
}

let publishTimer: ReturnType<typeof setTimeout> | null = null;

export function publishPresence(docId: string): void {
  if (publishTimer) clearTimeout(publishTimer);
  publishTimer = setTimeout(async () => {
    publishTimer = null;
    if (!sessionId) return;
    try {
      await api('/sessions/current', {
        method: 'PUT',
        body: JSON.stringify({ currentDocumentId: docId })
      });
    } catch (e) {
      console.error('publishPresence failed', e);
    }
  }, 500);
}

```

`joinSession` POSTs to `/sessions` with the existing `sessionId` (or empty string
on first call) and stores the returned ID; a failure is logged and surfaced as a
toast, since stale presence data is user-visible — **except a 401** (2026-07-28):
that means the auth session itself lapsed, the app-wide expiry watcher
(`$systems/session/expiry`) is already bouncing to sign-in, and a presence toast
on top would just be noise. `leaveSession` DELETEs
`/sessions/current` and clears the local ID, logging any failure. `publishPresence`
sends the current document ID via PUT to `/sessions/current`, debounced by 500ms so
rapid switches between documents collapse into a single publish; it is skipped when
no session has been joined yet (no `sessionId`).

## Last-editor tracking

### Current document store, last-editor state, and history refresh

```ts
/** Set from the editor when the document is loaded. */
export const currentDocumentId = writable<string>('');

/**
 * The author of the newest change to the current document — drives the document
 * bar's "Edited … by X" attribution. `null` until refreshed, in which case the
 * attribution falls back to the current user.
 */
export const lastEditorInfo = writable<{ id: string; name: string } | null>(null);

/** Refresh the last-editor from the newest history entry for a document. */
export async function refreshLastEditor(documentId: string): Promise<void> {
  if (!documentId) {
    lastEditorInfo.set(null);
    return;
  }
  try {
    const page = await fetchDocumentHistory(documentId, 1);
    const newest = page.entries[0];
    lastEditorInfo.set(newest ? { id: newest.authorId, name: newest.authorName } : null);
  } catch {
    lastEditorInfo.set(null);
  }
}

```

`currentDocumentId` is set by the editor when a document loads. `lastEditorInfo`
holds the author of the newest change, or `null` when unknown. `refreshLastEditor`
fetches the single newest history entry for a document and records its author,
clearing the store for an empty document id or on failure.

## Derived document bar collaboration

### The derived collaboration projection

```ts
export const documentBarCollaboration = derived(
  [session, projects, activeProjectId, projectSessions, currentDocumentId, lastEditorInfo],
  ([
    $session,
    $projects,
    $activeProjectId,
    $projectSessions,
    $currentDocumentId,
    $lastEditorInfo
  ]): DocumentBarCollaboration => {
    const current: DocumentCollaborator = $session.user
      ? {
          id: $session.user.id,
          name: $session.user.name,
          email: $session.user.email,
          access: 'You',
          current: true,
          mock: false
        }
      : {
          id: 'mock_current',
          name: 'Current editor',
          access: 'You',
          current: true,
          mock: true
        };

    const project = $activeProjectId
      ? $projects.find((p) => p.id === $activeProjectId)
      : null;

    const memberRole = (userId: string): 'Editor' | 'Viewer' => {
      const member = project?.members.find((m) => m.id === userId);
      if (!member) return 'Viewer';
      return member.role === 'owner' || member.role === 'editor' ? 'Editor' : 'Viewer';
    };

    const openUsers: DocumentCollaborator[] = [current];

    for (const s of $projectSessions) {
      if (s.userId === current.id) continue;
      if ($currentDocumentId && s.currentDocumentId !== $currentDocumentId) continue;
      openUsers.push({
        id: s.userId,
        name: s.userName,
        access: memberRole(s.userId),
        current: false,
        mock: false
      });
    }

    // The last editor is the newest change's author (from history) when known,
    // else the current user. Match against the current user so "You" still shows.
    const lastEditor: DocumentCollaborator = $lastEditorInfo
      ? {
          id: $lastEditorInfo.id,
          name: $lastEditorInfo.name,
          access: $lastEditorInfo.id === current.id ? 'You' : memberRole($lastEditorInfo.id),
          current: $lastEditorInfo.id === current.id,
          mock: false
        }
      : current;

    return { lastEditor, openUsers };
  }
);

```

The `documentBarCollaboration` derived store reacts to six inputs: `session`
(signed-in user), `projects` (project list with members), `activeProjectId`
(which project is being polled), `projectSessions` (raw Omega sessions),
`currentDocumentId` (which document is open), and `lastEditorInfo` (the newest
change's author). The signed-in user is always first with `access: 'You'`; when
there is no session, a mock fallback provides a placeholder. The `project` is
resolved from the `activeProjectId` to feed `memberRole`, which looks up a user's
membership and returns `'Editor'` for owners/editors and `'Viewer'` for everyone
else (including non-members). Each Omega session whose userId differs from the
current user and whose `currentDocumentId` matches (when a document ID is set) is
appended to the open-users list with a real access label. `lastEditor` is the
newest change's author when known — matched against the current user so "You"
still shows — otherwise the current user.

## Time re-exports

### Re-export time formatting utilities

```ts
export { documentEditStamp, documentEditRelative } from '$data/time';
```

`documentEditStamp` and `documentEditRelative` are forwarded from the shared
`$data/time` module so consumers can import everything from one place.
