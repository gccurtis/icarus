import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { externalFilesLimits } from "$capabilities/external-files/api/shared/configuration";
import { externalDirectoriesIn } from "$capabilities/external-files/api/shared/directories";
import { externalFilesIn } from "$capabilities/external-files/api/shared/rows";
import type { ReadExternalFileLibraryResult } from "$capabilities/external-files/types/external-files";

export const readExternalFileLibrary = async (): Promise<ReadExternalFileLibraryResult> => {
  const scope = await requireScope();
  const model = serverModel();
  const files = externalFilesIn(model, scope);
  return {
    files: files
      .map(({ item }) => item)
      .sort((left, right) => right.updatedAt - left.updatedAt || left.name.localeCompare(right.name)),
    directories: externalDirectoriesIn(files),
    limits: externalFilesLimits(model.configuration)
  };
};
