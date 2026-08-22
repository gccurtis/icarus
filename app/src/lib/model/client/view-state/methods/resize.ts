import type { ViewStateData } from "$model/client/view-state/definition.svelte";
import type { Frame } from "$model/client/view-state/types";

/**
 * Record a drag.
 *
 * **It cannot reach `contextId`**, and that is the point of it being its own
 * method over its own type: a drag can never move the rail and a rail click can
 * never resize a panel, structurally rather than by convention.
 *
 * The frame is replaced rather than mutated, so a reader holding the old one
 * sees a consistent set of four numbers rather than a half-applied drag.
 */
export const resize = (state: ViewStateData, patch: Partial<Frame>): void => {
  const tab = state.active;
  tab.frame = { ...tab.frame, ...patch };
};
