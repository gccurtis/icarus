import type { WorkspaceStateModel } from "$model/client/workspace-state";
import { inspectExternalFile } from "$app-views/categories/external/procedures/inspect-file";

export const inspectExternalHistoryFile = (
  view: WorkspaceStateModel,
  externalFileId: string
): void => inspectExternalFile(view, externalFileId);

export const inspectExternalHistoryActor = (
  view: WorkspaceStateModel,
  actorId: string
): void => view.inspect("general.person", { kind: "person", id: actorId });
