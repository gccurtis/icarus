import { readExternalFile, readExternalFileLibrary, relocateExternalFile as remote } from "$capabilities/external-files/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { LibraryExternalFileDetail } from "$app-views/categories/external/procedures/library-query";

export const relocateExternalFile = (
  view: WorkspaceStateModel,
  row: Pick<LibraryExternalFileDetail, "id" | "revision">,
  destinationDirectory: string
) => view.singleFlight(
  ["external-file", view.project, row.id, "relocate", row.revision, destinationDirectory.trim()],
  () => remote({
    externalFileId: row.id,
    baseRevision: row.revision,
    destinationDirectory: destinationDirectory.trim()
  }).updates(readExternalFileLibrary, readExternalFile({ externalFileId: row.id }))
);
