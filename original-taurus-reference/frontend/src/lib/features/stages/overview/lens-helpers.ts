import type { Resource, ResourceKind } from '$data/resources';
import type { ActivityEvent } from '$data/projects';

/**
 * Pure projections behind the Overview inspector lenses. They live here rather
 * than inside the lens components so they can be tested directly.
 *
 * The **access rule** used to live here too. It moved to
 * `features/shared/activity-access.ts` on 2026-07-29 when the context rail's
 * History lens needed it: the rail is shell, and the shell must not import from a
 * stage. Overview's own consumers now import it from `shared/` directly rather
 * than through a re-export here — a facade that forwards someone else's module is
 * the disease the L1–L3 cleanup removed.
 */

/**
 * How far the Overview feed will page.
 *
 * Matches Omega's own `activity.MaxLimit` (100), which is the most a single
 * request may ask for — so this is the app agreeing with the backend's ceiling
 * rather than inventing one. Without it the feed pages forever as you scroll,
 * and "all of this project's history" is not a question this surface answers.
 */
export const FEED_EVENT_CAP = 100;

/**
 * How many events a single resource's activity list shows. Small on purpose: it
 * lives inside an inspector panel behind a fixed-height scroller, and its job is
 * "what has been happening lately", not an audit log.
 */
export const RESOURCE_EVENT_CAP = 25;

/** Kind counts for the multi-selection lens, ordered largest first. */
export function kindBreakdown(
  list: Resource[],
  label: (kind: ResourceKind) => string
): { kind: ResourceKind; label: string; count: number }[] {
  const counts = new Map<ResourceKind, number>();
  for (const r of list) counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
  return [...counts.entries()]
    .map(([kind, count]) => ({ kind, label: label(kind), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** The update-time span of a set of resources; null when the set is empty. */
export function updatedSpan(list: Resource[]): { newest: number; oldest: number } | null {
  if (!list.length) return null;
  let newest = list[0].updatedAt;
  let oldest = list[0].updatedAt;
  for (const r of list) {
    if (r.updatedAt > newest) newest = r.updatedAt;
    if (r.updatedAt < oldest) oldest = r.updatedAt;
  }
  return { newest, oldest };
}

/** Past-tense event phrasing for a lens heading ("Edited", "Created"). */
export function actionTitle(action: ActivityEvent['action']): string {
  return action.charAt(0).toUpperCase() + action.slice(1);
}
