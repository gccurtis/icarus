import { derived, get } from 'svelte/store';
import { session } from '$data/session';
import { roster } from '$data/projects';
import { mockPresentMembers } from './mocks';
import type { ProjectPresence, PresentUser } from './types';

/**
 * Project presence — who is on this project right now.
 *
 * A `derived` store rather than a poller, because there is nothing to poll: Omega's
 * presence is keyed by document, so a project-level list cannot be read from it (see
 * `docs/backend-requests/project-level-presence.md`). It is composed from the
 * session (you, for real) and the cached roster (everyone else, mocked).
 *
 * When the request lands this becomes the only file that changes: the shape
 * `ProjectPresence` and the lens that renders it stay as they are.
 */
export const projectPresence = derived([session, roster], ([$session, $roster]): ProjectPresence => {
  const projectId = $roster.projectId;
  if (!projectId) return { projectId: '', present: [], mocked: false };

  const me = $session.user;
  const present: PresentUser[] = me ? [{ userId: me.id, name: me.name, mock: false }] : [];
  const others = mockPresentMembers(projectId, $roster.members, me?.id ?? '');

  return { projectId, present: [...present, ...others], mocked: others.length > 0 };
});

/** Whether a user reads as present, for a roster row's dot. */
export function isPresent(presence: ProjectPresence, userId: string): boolean {
  return presence.present.some((p) => p.userId === userId);
}

/** The current presence value — for callers outside a reactive context. */
export function currentPresence(): ProjectPresence {
  return get(projectPresence);
}
