import { readExternalFile, readExternalFileLibrary, updateExternalFileContext as remote } from "$capabilities/external-files/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { LibraryExternalFileDetail } from "$app-views/categories/external/procedures/library-query";

export const updateExternalFileContext = (
  view: WorkspaceStateModel,
  row: Pick<LibraryExternalFileDetail, "id" | "revision">,
  semanticContext: string
) => view.singleFlight(
  ["external-file", view.project, row.id, "context", row.revision, semanticContext.trim()],
  () => remote({ externalFileId: row.id, baseRevision: row.revision, semanticContext })
    .updates(readExternalFileLibrary, readExternalFile({ externalFileId: row.id }))
);
