import type { WorkspaceOp } from "$representation/data/types/workspace/op";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";

export const apply = (state: WorkspaceStateData, op: WorkspaceOp): void => {
  switch (op.op) {
    case "open":
      state.views.set(op.tab, op.view);
      state.tabs.add(
        { id: op.tab, category: op.target.category, resourceId: op.target.resourceId },
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
