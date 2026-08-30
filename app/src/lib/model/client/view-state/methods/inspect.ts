import type { ViewStateData } from "$model/client/view-state/definition.svelte";
import { isInspectionKey } from "$model/client/view-state/methods/shared/panel-keys";
import type { Inspected, Selection } from "$model/client/view-state/types";

/**
 * Open a lens, and record what it is about.
 *
 * **The key never carries the detail.** An inspection key is a namespaced label
 * naming a file — `"collaboration.person"` is `inspector/collaboration/person.svelte`
 * — and the thing it is about lives in `selection`, once. The two were one field
 * before, and that was a second record of what the user had selected beside the
 * one already in view state.
 *
 * **Passing no selection leaves the current one alone.** A breadcrumb changes
 * the lens without changing what is selected, and so does closing a lens back to
 * `"empty"`; forcing every caller to restate the selection would make those
 * callers the place a selection gets lost.
 */
export const inspect = (state: ViewStateData, key: Inspected, selection?: Selection): void => {
  if (key !== "empty" && !isInspectionKey(key)) {
    throw new Error(`'${key}' is not a lens`);
  }

  const tab = state.active;
  tab.inspected = key;
  if (selection !== undefined) tab.selection = selection;
};
