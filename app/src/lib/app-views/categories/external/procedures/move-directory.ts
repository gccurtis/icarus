import { readExternalFileLibrary, relocateExternalDirectory as remote } from "$capabilities/external-files/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { LibraryExternalDirectory } from "$app-views/categories/external/procedures/library-query";

export const relocateExternalDirectory = (
  view: WorkspaceStateModel,
  row: Pick<LibraryExternalDirectory, "relativePath" | "revisionToken">,
  destinationDirectory: string
) => {
  const canonicalDirectory = destinationDirectory.trim().normalize("NFC");
  return view.singleFlight(
  [
    "external-directory",
    view.project,
    row.relativePath,
    "relocate",
    row.revisionToken,
    canonicalDirectory
  ],
  () => remote({
    sourceDirectory: row.relativePath,
    destinationDirectory: canonicalDirectory,
    baseRevisionToken: row.revisionToken
  }).updates(readExternalFileLibrary)
  );
};
