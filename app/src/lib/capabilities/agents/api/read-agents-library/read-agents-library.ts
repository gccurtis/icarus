import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { library } from "$capabilities/agents/api/shared/projection";
import type { ReadAgentsLibraryResult } from "$capabilities/agents/types/agents";

export const readAgentsLibrary = async (): Promise<ReadAgentsLibraryResult> => {
  const scope = await requireScope();
  return library(serverModel().store, scope);
};
