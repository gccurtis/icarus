import type { WorkspaceStateModel } from "$model/client/workspace-state";

export const inspectExternalFile = (view: WorkspaceStateModel, externalFileId: string): void => {
  view.open({ category: "external", focus: externalFileId });
  view.inspect("external.file", { kind: "external-file", id: externalFileId });
};
