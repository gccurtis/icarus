import { readExternalFile, readExternalFileLibrary, removeExternalFile as remote } from "$capabilities/external-files/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { LibraryExternalFileDetail } from "$app-views/categories/external/procedures/library-query";

export const removeExternalFile = (
  view: WorkspaceStateModel,
  row: Pick<LibraryExternalFileDetail, "id" | "revision">
) => view.singleFlight(
  ["external-file", view.project, row.id, "remove", row.revision],
  () => remote({ externalFileId: row.id, baseRevision: row.revision })
    .updates(readExternalFileLibrary, readExternalFile({ externalFileId: row.id }))
);
