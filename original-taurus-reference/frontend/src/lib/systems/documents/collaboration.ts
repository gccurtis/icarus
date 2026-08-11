import { writable, derived, get } from 'svelte/store';
import { api, isApiError } from '$data/api';
import { session } from '$data/session';
import { projects } from '$data/projects';
import { toast } from '$lib/toast';
import { fetchDocumentHistory } from './api';

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

export { documentEditStamp, documentEditRelative } from '$data/time';
