import { readExternalFile, readExternalFileLibrary, renameExternalFile as remote } from "$capabilities/external-files/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { LibraryExternalFileDetail } from "$app-views/categories/external/procedures/library-query";

export const renameExternalFile = (
  view: WorkspaceStateModel,
  row: Pick<LibraryExternalFileDetail, "id" | "revision">,
  name: string
) => view.singleFlight(
  ["external-file", view.project, row.id, "rename", row.revision, name.trim()],
  () => remote({ externalFileId: row.id, baseRevision: row.revision, name: name.trim() })
    .updates(readExternalFileLibrary, readExternalFile({ externalFileId: row.id }))
);
