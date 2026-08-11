import { writable, get } from 'svelte/store';
import { isApiError } from '$data/api';
import type { Member, Role } from './types';
import { fetchMembers } from './api';

/**
 * The active project's member roster, cached for the READ-ONLY surfaces.
 *
 * `ProjectSharing` deliberately keeps its own copy: it writes (invite, role
 * change, remove) and wants its list to reflect exactly what it just did. The
 * context rail's Properties and Members lenses only read, they mount one at a
 * time as the user flips sections, and re-fetching `GET /projects/:id/members`
 * on every flip is waste — so they share this store instead.
 *
 * Strict project isolation (design law): the state names the project it belongs
 * to, and a load for a different project REPLACES it rather than merging, so one
 * project's roster can never be read as another's.
 */

export type RosterState = {
  /** The project this roster belongs to; '' when nothing is loaded. */
  projectId: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
  members: Member[];
  error: string;
};

const fresh = (): RosterState => ({ projectId: '', status: 'idle', members: [], error: '' });

export const roster = writable<RosterState>(fresh());

/** Role order for every roster surface: owner, then editors, then viewers. */
const ROLE_RANK: Record<Role, number> = { owner: 0, editor: 1, viewer: 2 };

/**
 * Owner first, then editors, then viewers; alphabetical within a role.
 *
 * Pure and exported so the ordering is tested once rather than asserted through
 * a component — it is the one part of the Members lens the user specified
 * exactly.
 */
export function byAccess(members: Member[]): Member[] {
  return [...members].sort(
    (a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role] || a.name.localeCompare(b.name)
  );
}

/** The project's owner, or null when the roster hasn't loaded (or has none). */
export function ownerOf(members: Member[]): Member | null {
  return members.find((m) => m.role === 'owner') ?? null;
}

/**
 * Load the roster for a project, at most once per project unless forced.
 *
 * A late response for a project the user has already left is dropped: the guard
 * re-reads the store's `projectId` after the await, which is the same shape the
 * rest of the app uses for project-scoped fetches.
 */
export async function loadRoster(projectId: string, force = false): Promise<void> {
  if (!projectId) return;
  const current = get(roster);
  const sameProject = current.projectId === projectId;
  if (sameProject && !force && (current.status === 'ready' || current.status === 'loading')) return;

  roster.set({ projectId, status: 'loading', members: sameProject ? current.members : [], error: '' });
  try {
    const members = await fetchMembers(projectId);
    if (get(roster).projectId !== projectId) return;
    roster.set({ projectId, status: 'ready', members, error: '' });
  } catch (e) {
    if (get(roster).projectId !== projectId) return;
    roster.set({
      projectId,
      status: 'error',
      members: [],
      error: isApiError(e) ? e.message : 'Could not load members'
    });
  }
}

/** Drop the cached roster — used when a project is left or membership changes. */
export function resetRoster(): void {
  roster.set(fresh());
}
