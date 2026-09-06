import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { projectLibrary } from "$capabilities/templates/api/shared/projection";
import type { ReadTemplateLibraryResult } from "$capabilities/templates/types/templates";

export const readTemplateLibrary = async (): Promise<ReadTemplateLibraryResult> => {
  const scope = await requireScope();
  return projectLibrary(serverModel().store, scope);
};
