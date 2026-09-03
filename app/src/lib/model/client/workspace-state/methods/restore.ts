import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";
import { adopt } from "$model/client/workspace-state/methods/shared/adopt";

export const restore = async (state: WorkspaceStateData): Promise<void> => {
  if (!state.persists || state.log.length > 0) return;

  await adopt(state, () => state.log.length === 0);

  state.sync = "saved";
};
