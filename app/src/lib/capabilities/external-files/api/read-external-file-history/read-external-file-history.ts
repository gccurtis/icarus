import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { externalFileHistoryIn } from "$capabilities/external-files/api/shared/history";
import type { ReadExternalFileHistoryResult } from "$capabilities/external-files/types/external-files";

export const readExternalFileHistory = async (): Promise<ReadExternalFileHistoryResult> => {
  const scope = await requireScope();
  return { entries: externalFileHistoryIn(serverModel(), scope) };
};
