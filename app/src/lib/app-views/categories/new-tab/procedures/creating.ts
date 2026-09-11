import {
  createProjectResource as createProjectResourceRemote,
  readProjectResourceIndex,
  type CreateProjectResourceInput
} from "$capabilities/project-resources/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

/**
 * Mint a represented resource before opening its editor.
 *
 * The editor title reads the represented resource table, not the merged project
 * index. Refresh both views before opening so an opaque id never appears as a
 * disconnected tab while its newly created row is already durable.
 */
export const createProjectResource = (
  view: WorkspaceStateModel,
  originTabId: string,
  input: CreateProjectResourceInput
) => {
  return view.singleFlight(
    ["new-tab", view.project, originTabId, "create", input.target, input.title?.trim() ?? null],
    async () => {
      return createProjectResourceRemote(input).updates(readProjectResourceIndex);
    }
  );
};
