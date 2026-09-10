import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

import type { Id } from "$representation/data/types/core/id";
import type { ExternalFileStorageState } from "$model/server/external-file-storage/definition";
import type { ExternalFileStorageReceipt } from "$model/server/external-file-storage/types";
import {
  createClaim,
  readVerified,
  restoreCanonicalFrom,
  syncDirectory
} from "$model/server/external-file-storage/methods/shared/io";
import {
  validateOwnerId,
  validateReceipt
} from "$model/server/external-file-storage/methods/shared/validation";

export const claimPublication = async (
  state: ExternalFileStorageState,
  untrustedReceipt: ExternalFileStorageReceipt,
  untrustedOwnerId: Id<"externalFiles">
): Promise<void> => {
  const receipt = validateReceipt(untrustedReceipt);
  const ownerId = validateOwnerId(untrustedOwnerId);
  await mkdir(state.directory, { recursive: true });
  await createClaim(state.directory, receipt.hash, ownerId);
  await syncDirectory(state.directory);
  if (await readVerified(state.directory, receipt) === undefined) {
    await restoreCanonicalFrom(state.directory, receipt.publicationToken, receipt);
  }
  await rm(join(state.directory, receipt.publicationToken), { force: true });
  await syncDirectory(state.directory);
};
