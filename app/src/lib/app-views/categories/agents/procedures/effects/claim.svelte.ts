import { inspectAgent, type Inspectable } from "$app-views/categories/agents/procedures/inspect";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

/**
 * The inspector opens on whatever the centre is showing, once per thing.
 *
 * `claimed` is what has already been handed over, so somebody who then chose a
 * different row in a panel is not dragged back on the next redraw.
 */
export const followShownThing = (
  view: WorkspaceStateModel,
  state: { claimed: string | undefined },
  target: () => Inspectable | undefined
): void => {
  $effect(() => {
    const next = target();
    if (next === undefined || state.claimed === next.id) return;
    state.claimed = next.id;
    inspectAgent(view, next);
  });
};
