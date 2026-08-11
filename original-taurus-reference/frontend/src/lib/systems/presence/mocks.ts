import type { Member } from '$data/projects';
import type { PresentUser } from './types';

/**
 * The mocked half of project presence.
 *
 * What is mocked is the *presence*, not the people: entries are drawn from the
 * project's REAL member roster, so the Members lens never shows an invented
 * colleague. Only the claim "they are here right now" is fiction.
 */

/** A stable 32-bit hash of a string — enough to pick a subset deterministically. */
function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Which other members read as "on now" for a project.
 *
 * Deterministic — keyed on the project id and each member's id, never
 * `Math.random()`. A presence list that reshuffled on every re-render would look
 * like people walking in and out of the room, and would make the surface
 * impossible to write a test against.
 *
 * Roughly a third of the roster, and never the current user (the caller adds them
 * as a real entry).
 */
export function mockPresentMembers(
  projectId: string,
  members: Member[],
  currentUserId: string
): PresentUser[] {
  if (!projectId) return [];
  const seed = hash(projectId);
  return members
    .filter((m) => m.id !== currentUserId)
    .filter((m) => (hash(m.id) ^ seed) % 3 === 0)
    .map((m) => ({ userId: m.id, name: m.name, mock: true }));
}
