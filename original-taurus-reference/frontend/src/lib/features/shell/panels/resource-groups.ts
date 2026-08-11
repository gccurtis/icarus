import { RESOURCE_KINDS, type Resource } from '$data/resources';

/**
 * The projection behind the context rail's "All resources" lens: the catalog as
 * collapsible groups, filtered by the lens's search field.
 *
 * It is pure and separate from the panel so the two rules that are easy to get
 * subtly wrong — what a pinned resource counts as, and what a group's count means
 * while a search is active — are tested directly instead of inferred from
 * rendered DOM.
 */

export type ResourceGroup = {
  /** `'pinned'` or a `ResourceKind` — stable, so collapse state can key on it. */
  id: string;
  label: string;
  /** The rows to draw: everything in the group, or just the search matches. */
  items: Resource[];
  /** How many the group holds in TOTAL, ignoring the search. */
  total: number;
};

export const PINNED_GROUP = 'pinned';

/** Name-substring match, case-insensitive. The only field the rail searches. */
function matches(resource: Resource, query: string): boolean {
  return !query || resource.name.toLowerCase().includes(query);
}

/** Most recently touched first, then by name so the order is deterministic. */
function byRecency(a: Resource, b: Resource): number {
  return b.updatedAt - a.updatedAt || a.name.localeCompare(b.name);
}

/**
 * Group the catalog for the rail.
 *
 * **A pinned resource appears in BOTH its `Pinned` group and its kind group.**
 * Pinned is a shortcut, not a relocation: if it moved rows out of `Documents`,
 * that group's count would stop meaning "how many documents this project has",
 * and pinning something would make it *harder* to find in the place you'd look
 * for it. Duplication is the honest reading of a shortcut.
 *
 * Kinds keep `RESOURCE_KINDS` order (documents, sheets, slides, chats, general)
 * so the rail's groups sit in the same order as every other kind list in the app,
 * and a kind with nothing in it is omitted rather than shown as an empty group.
 *
 * While a query is active, `items` holds only matches and groups with none are
 * dropped — but `total` still reports the unfiltered size, which is what lets the
 * header read "2 of 4".
 */
export function groupResources(list: Resource[], query = ''): ResourceGroup[] {
  const q = query.trim().toLowerCase();
  const groups: ResourceGroup[] = [];

  const pinned = list.filter((r) => r.pinned);
  if (pinned.length) {
    groups.push({
      id: PINNED_GROUP,
      label: 'Pinned',
      items: pinned.filter((r) => matches(r, q)).sort(byRecency),
      total: pinned.length
    });
  }

  for (const kind of RESOURCE_KINDS) {
    const all = list.filter((r) => r.kind === kind.id);
    if (!all.length) continue;
    groups.push({
      id: kind.id,
      label: kind.label,
      items: all.filter((r) => matches(r, q)).sort(byRecency),
      total: all.length
    });
  }

  return q ? groups.filter((g) => g.items.length > 0) : groups;
}

/**
 * "N of M match" for the lens header, or null when nothing is being searched.
 *
 * Counted from the catalog rather than by summing the groups, because a pinned
 * resource is in two groups and would otherwise be counted twice.
 */
export function matchSummary(list: Resource[], query = ''): { matched: number; total: number } | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  return { matched: list.filter((r) => matches(r, q)).length, total: list.length };
}
