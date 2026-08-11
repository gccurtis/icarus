import type { ActivityEvent } from '$data/projects';

/**
 * What an activity feed is allowed to SHOW — the access rule shared by every
 * surface that renders activity.
 *
 * It moved here from `stages/overview/lens-helpers.ts` when the context rail's
 * History lens needed it (2026-07-29). The rail is shell, not a stage, and the
 * shell must not import from a stage (AGENTS.md → ownership-is-the-tree), so the
 * rule lives in `shared/` where both can reach it. Duplicating it was not an
 * option: this is the one piece of the activity feature where being wrong
 * discloses something.
 */

/** What a redacted activity target reads as. Deliberately one word. */
export const REDACTED_LABEL = 'Redacted';

/**
 * The resources whose deletion this feed has already reported.
 *
 * The feed is newest-first, so a resource's `deleted` event always loads before
 * the older `created`/`edited` events naming it. That ordering is what lets the
 * client tell "gone" apart from "restricted" without asking the server: a target
 * missing from the catalog is restricted *unless* its deletion is on record.
 */
export function deletedTargetIds(events: ActivityEvent[]): Set<string> {
  const ids = new Set<string>();
  for (const event of events) if (event.action === 'deleted') ids.add(event.target.id);
  return ids;
}

/**
 * Whether an event's target must be redacted.
 *
 * Omega filters `GET /resources` by access scope, so the catalog is exactly the
 * set this user is allowed to know exists — but `GET /activity` performs no such
 * check and ships every event's target id, name, and kind. Alpha closes that
 * here, which means this must FAIL CLOSED: anything not positively known to be
 * visible or deleted is redacted.
 *
 * Callers must not invoke this until the catalog has actually loaded
 * (`resourcesLoaded`), or the initial empty list redacts the whole feed.
 */
export function isTargetRedacted(
  event: ActivityEvent,
  visibleIds: Set<string>,
  deletedIds: Set<string>
): boolean {
  if (visibleIds.has(event.target.id)) return false;
  return !deletedIds.has(event.target.id);
}
