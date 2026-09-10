import { rm } from "node:fs/promises";
import { join } from "node:path";

import type { ExternalFileStorageState } from "$model/server/external-file-storage/definition";
import type { ExternalFileStorageClaim } from "$model/server/external-file-storage/types";
import { syncDirectory } from "$model/server/external-file-storage/methods/shared/io";
import { claimName } from "$model/server/external-file-storage/methods/shared/names";
import { validateClaim } from "$model/server/external-file-storage/methods/shared/validation";

export const releaseClaim = async (
  state: ExternalFileStorageState,
  untrustedClaim: ExternalFileStorageClaim
): Promise<void> => {
  const claim = validateClaim(untrustedClaim);
  await rm(join(state.directory, claimName(claim.hash, claim.ownerId)), { force: true });
  await syncDirectory(state.directory);
};
