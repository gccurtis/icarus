import type { WorkspaceStateModel } from "$model/client/workspace-state";

export const inspectExternalDirectory = (
  view: WorkspaceStateModel,
  relativePath: string
): void => {
  view.open({ category: "external" });
  view.inspect("external.directory", { kind: "external-directory", id: relativePath });
};
