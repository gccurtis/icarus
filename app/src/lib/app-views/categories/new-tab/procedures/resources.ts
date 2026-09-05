import {
  createProjectResource as createProjectResourceRemote,
  readProjectResourceIndex,
  type CreateProjectResourceInput
} from "$capabilities/project-resources/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

/** Create once even if this launcher remounts while the represented write is pending. */
export const createProjectResource = (
  view: WorkspaceStateModel,
  input: CreateProjectResourceInput
) =>
  view.singleFlight(
    [
      "project-resource",
      view.project,
      "create",
      input.target,
      input.title?.trim() ?? null
    ],
    () => createProjectResourceRemote(input).updates(readProjectResourceIndex)
  );
