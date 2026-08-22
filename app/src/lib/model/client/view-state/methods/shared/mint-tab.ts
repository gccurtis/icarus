import { defaultContext, defaultSubscreen } from "$model/client/view-state/methods/shared/rails";
import { DEFAULT_FRAME, type Tab, type TabId, type Target } from "$model/client/view-state/types";

/**
 * The only place a tab is minted.
 *
 * Called by the constructor for the singletons and by `open` for everything
 * else, so every tab in the application starts the same way — which is what
 * makes "every member of `frame` is present from the first frame" a fact rather
 * than a convention.
 *
 * **The rail is chosen here, not left empty.** A tab with no context id would
 * make every reader of it handle a state that exists for one tick, and the
 * specification already says which view each screen opens on.
 *
 * **The frame is copied, not shared.** `DEFAULT_FRAME` is frozen, and a tab that
 * held a reference to it would throw the first time anyone dragged an edge.
 */
export const mintTab = (id: TabId, target: Target): Tab => {
  // A permanent tab opens on its library — see `DEFAULT_SUBSCREEN`, which names
  // it rather than deriving it, because neither the alphabet nor the order of
  // the specification's tables gets it right for every screen.
  const subscreen = target.subscreen ?? defaultSubscreen(target.screen);
  return {
    id,
    screen: target.screen,
    subscreen,
    resourceId: target.resourceId,
    contextId: defaultContext(target.screen, subscreen),
    inspected: "empty",
    frame: { ...DEFAULT_FRAME }
  };
};
