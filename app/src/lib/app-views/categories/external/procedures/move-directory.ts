import { readExternalFileLibrary, relocateExternalDirectory as remote } from "$capabilities/external-files/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { LibraryExternalDirectory } from "$app-views/categories/external/procedures/library-query";

export const relocateExternalDirectory = (
  view: WorkspaceStateModel,
  row: Pick<LibraryExternalDirectory, "relativePath" | "revisionToken">,
  destinationDirectory: string
) => view.singleFlight(
  [
    "external-directory",
    view.project,
    row.relativePath,
    "relocate",
    row.revisionToken,
    destinationDirectory.trim()
  ],
  () => remote({
    sourceDirectory: row.relativePath,
    destinationDirectory: destinationDirectory.trim(),
    baseRevisionToken: row.revisionToken
  }).updates(readExternalFileLibrary)
);
