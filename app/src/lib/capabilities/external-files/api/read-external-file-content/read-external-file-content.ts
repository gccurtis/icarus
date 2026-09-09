import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { externalFilesLimits } from "$capabilities/external-files/api/shared/configuration";
import { externalFileIn } from "$capabilities/external-files/api/shared/rows";
import { validateReadExternalFileContent } from "$capabilities/external-files/api/read-external-file-content/validate-read-external-file-content";
import type { ReadExternalFileContentResult } from "$capabilities/external-files/types/external-files";

export const readExternalFileContent = async (
  input: unknown
): Promise<ReadExternalFileContentResult> => {
  const scope = await requireScope();
  const asked = validateReadExternalFileContent(input);
  const model = serverModel();
  const found = externalFileIn(model, scope, asked.externalFileId);
  if (found === null) return null;
  if ("unavailable" in found) throw new Error(found.detail);
  const bytes = await model.externalFileStorage.read({
    storageId: found.row.storageId,
    hash: found.row.hash,
    ...(found.item.size === null ? {} : { size: found.item.size })
  });
  if (bytes === undefined) throw new Error("The file's native bytes are unavailable.");
  const { maxResponseBytes } = externalFilesLimits(model.configuration);
  if (bytes.byteLength > maxResponseBytes) {
    throw new Error(`The file exceeds the ${maxResponseBytes} byte response limit.`);
  }
  return {
    externalFileId: found.row._id,
    name: found.item.name,
    mediaType: found.item.mediaType,
    hash: found.row.hash,
    bytes
  };
};
