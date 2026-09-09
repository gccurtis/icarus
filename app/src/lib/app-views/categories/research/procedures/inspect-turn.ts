import type { WorkspaceStateModel } from "$model/client/workspace-state";

export const inspectTurn = (view: WorkspaceStateModel, turnId: string): void => {
  view.inspect("research.turn", { kind: "turn", id: turnId });
};
