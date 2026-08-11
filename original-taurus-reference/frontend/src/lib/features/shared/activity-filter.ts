import type { ActivityEvent } from '$data/projects';
import type { ResourceKind } from '$data/resources';

/**
 * What "filter this activity list" means — the model, the predicate, and the one
 * case that can be pushed to the server.
 *
 * Omega's `/activity` accepts only `limit`, `cursor`, and `targetID`: there is no
 * actor or kind parameter. Every event does carry `actor.id` and `target.kind` in
 * its payload, though, so a filter is a **predicate over loaded events** plus
 * paging — the caller keeps asking for pages and says how far it has looked. That
 * is honest and complete in the limit, and needs nothing from the backend.
 */

export type ActivityFilter = {
  /** Match any of these actors (empty = anyone). */
  actorIds: string[];
  /** Match any of these resources. ORed with `kinds`. */
  resourceIds: string[];
  /** Match any resource of these kinds — "all documents". ORed with `resourceIds`. */
  kinds: ResourceKind[];
};

export const EMPTY_FILTER: ActivityFilter = { actorIds: [], resourceIds: [], kinds: [] };

export function isFilterActive(filter: ActivityFilter): boolean {
  return filter.actorIds.length > 0 || filter.resourceIds.length > 0 || filter.kinds.length > 0;
}

/**
 * Whether an event survives the filter.
 *
 * Dimensions AND together, values within a dimension OR — with one deliberate
 * exception: `resourceIds` and `kinds` OR with **each other**, because both answer
 * the same question ("which resource"). Picking "Q3 brief" and also ticking "all
 * slides" means *that document or any deck*, which is what the picker's per-kind
 * "select all" reads as. ANDing them would make that selection match nothing,
 * since no resource is simultaneously one named document and a deck.
 */
export function matchesFilter(event: ActivityEvent, filter: ActivityFilter): boolean {
  if (filter.actorIds.length && !filter.actorIds.includes(event.actor.id)) return false;

  const targetNamed = filter.resourceIds.length > 0 || filter.kinds.length > 0;
  if (!targetNamed) return true;
  return filter.resourceIds.includes(event.target.id) || filter.kinds.includes(event.target.kind);
}

/** Apply the filter to a list, preserving order. */
export function filterEvents(events: ActivityEvent[], filter: ActivityFilter): ActivityEvent[] {
  return isFilterActive(filter) ? events.filter((e) => matchesFilter(e, filter)) : events;
}

/**
 * The one filter Omega can answer itself.
 *
 * `/activity?targetID=` narrows server-side, so a filter naming exactly one
 * resource and no kinds is exact and cheap — no over-fetching, and paging counts
 * only that resource's events. Any other shape (several resources, a kind, or a
 * kind plus a resource) has to be the client predicate, because `targetID` takes a
 * single id. An actor filter can ride along on top of the narrowed stream.
 */
export function serverTargetId(filter: ActivityFilter): string | undefined {
  return filter.resourceIds.length === 1 && filter.kinds.length === 0
    ? filter.resourceIds[0]
    : undefined;
}

export type FilterChip = { key: string; label: string; clear: (filter: ActivityFilter) => ActivityFilter };

/**
 * The active filter as removable chips.
 *
 * Names are resolved by the caller (it has the roster and the catalog); anything
 * unresolvable falls back to a generic word rather than an id, because an id on
 * screen tells the user nothing about what they filtered by.
 */
export function filterChips(
  filter: ActivityFilter,
  names: { actor: (id: string) => string | undefined; resource: (id: string) => string | undefined; kind: (kind: ResourceKind) => string }
): FilterChip[] {
  const chips: FilterChip[] = [];

  for (const id of filter.actorIds) {
    chips.push({
      key: `actor:${id}`,
      label: names.actor(id) ?? 'Someone',
      clear: (f) => ({ ...f, actorIds: f.actorIds.filter((x) => x !== id) })
    });
  }
  for (const kind of filter.kinds) {
    chips.push({
      key: `kind:${kind}`,
      label: `All ${names.kind(kind).toLowerCase()}`,
      clear: (f) => ({ ...f, kinds: f.kinds.filter((x) => x !== kind) })
    });
  }
  for (const id of filter.resourceIds) {
    chips.push({
      key: `resource:${id}`,
      label: names.resource(id) ?? 'A resource',
      clear: (f) => ({ ...f, resourceIds: f.resourceIds.filter((x) => x !== id) })
    });
  }

  return chips;
}
