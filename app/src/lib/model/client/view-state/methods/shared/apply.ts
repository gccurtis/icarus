import type { ViewOp } from "$representation/data/types/views/op";
import type { ViewStateData } from "$model/client/view-state/definition.svelte";

export const apply = (state: ViewStateData, op: ViewOp): void => {
  switch (op.op) {
    case "open":
      state.views.set(op.tab, op.view);
      state.tabs.add(
        { id: op.tab, screen: op.target.screen, resourceId: op.target.resourceId },
        op.at
      );
      return;

    case "close":
      state.tabs.remove(op.tab);
      state.views.forget(op.tab);
      return;

    case "activate":
      state.tabs.activate(op.now);
      return;

    case "land":
      state.views.land(op.tab, op.now);
      return;

    case "context":
      state.views.selectContext(op.tab, op.now);
      return;

    case "inspect":
      state.views.inspect(op.tab, op.now, op.selection);
      return;

    case "resize":
      state.views.resize(op.tab, op.now);
      return;
  }
};
