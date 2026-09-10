import { rm } from "node:fs/promises";
import { join } from "node:path";

import type { ExternalFileStorageState } from "$model/server/external-file-storage/definition";
import type { ExternalFileStorageReceipt } from "$model/server/external-file-storage/types";
import { syncDirectory } from "$model/server/external-file-storage/methods/shared/io";
import { validateReceipt } from "$model/server/external-file-storage/methods/shared/validation";

export const discardPublication = async (
  state: ExternalFileStorageState,
  untrustedReceipt: ExternalFileStorageReceipt
): Promise<void> => {
  const receipt = validateReceipt(untrustedReceipt);
  await rm(join(state.directory, receipt.publicationToken), { force: true });
  await syncDirectory(state.directory);
};
