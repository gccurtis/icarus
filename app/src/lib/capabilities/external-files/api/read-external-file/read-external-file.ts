import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { externalFileIn } from "$capabilities/external-files/api/shared/rows";
import { externalFileUsage } from "$capabilities/external-files/api/shared/usage";
import { validateReadExternalFile } from "$capabilities/external-files/api/read-external-file/validate-read-external-file";
import type { ReadExternalFileResult } from "$capabilities/external-files/types/external-files";
import type { ExternalFileNativeState } from "$capabilities/external-files/types/external-files";

export const readExternalFile = async (input: unknown): Promise<ReadExternalFileResult> => {
  const scope = await requireScope();
  const asked = validateReadExternalFile(input);
  const model = serverModel();
  const found = externalFileIn(model, scope, asked.externalFileId);
  if (found === null || "unavailable" in found) return found;
  let native: ExternalFileNativeState;
  try {
    const bytes = await model.externalFileStorage.read({
      storageId: found.row.storageId,
      hash: found.row.hash,
      size: found.item.size
    });
    native = bytes === undefined ? { state: "missing" } : { state: "available", size: bytes.byteLength };
  } catch (error) {
    native = {
      state: "corrupt",
      detail: error instanceof Error ? error.message : String(error)
    };
  }
  return {
    ...found.item,
    hash: found.row.hash,
    native,
    usage: externalFileUsage(model.store, scope, found.row._id)
  };
};
