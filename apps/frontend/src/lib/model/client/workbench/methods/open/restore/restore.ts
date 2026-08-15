import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import { open } from "$model/client/workbench/methods/open/open";
import { storedOptions } from "$model/client/workbench/methods/open/restore/stored-options";
import { assignOptions } from "$model/client/workbench/methods/shared/assign-options";
import { isResourceKind } from "$model/client/workbench/types";

/**
 * Replays stored tabs through `open()`.
 *
 * It lives beneath `open/` because it is opening — the same path a click takes,
 * deliberately rather than conveniently:
 *
 * - `open` already dedupes on kind and id, so a stored duplicate of the
 *   permanent tab collapses into it rather than appearing twice.
 * - Ids are minted fresh. A stored id would be meaningless on this boot, and a
 *   restored `tab-1` colliding with one the counter is about to mint would make
 *   lookups return the wrong tab.
 * - The permanent tab is reconstructed rather than restored, so it cannot arrive
 *   wrong; only the options it remembers come from the store.
 */
export const restore = (state: WorkbenchState): void => {
  const stored = state.storage.workbench;
  if (!stored) return;

  for (const [kind, id, options] of stored.tabs) {
    // A kind from an older build may no longer exist. `ACTIVITIES_BY_KIND` is
    // keyed by kind, so an unknown one resolves to undefined and throws during
    // paint. Dropping it is what keeps a stale store from being a crash.
    if (!isResourceKind(kind)) continue;

    const tab = open(state, { kind, id });
    if (options) assignOptions(state, tab, storedOptions(options));
  }

  const active = stored.active;
  if (!active) return;

  // A ref rather than an index, so a dropped tab cannot silently activate its
  // neighbour. An unmatched ref leaves whatever `open` last activated, which is
  // always valid.
  const match = state.tabs.find(
    (tab) => tab.resource.kind === active[0] && tab.resource.id === active[1]
  );
  if (match) state.activeId = match.id;
};
