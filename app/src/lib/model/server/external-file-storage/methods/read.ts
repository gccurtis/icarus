import type { ExternalFileStorageState } from "$model/server/external-file-storage/definition";
import type { ExternalFileStorageRef } from "$model/server/external-file-storage/types";
import { readVerified } from "$model/server/external-file-storage/methods/shared/io";
import { validateRef } from "$model/server/external-file-storage/methods/shared/validation";

export const read = async (
  state: ExternalFileStorageState,
  untrustedRef: ExternalFileStorageRef,
  signal?: AbortSignal
): Promise<Uint8Array | undefined> => {
  signal?.throwIfAborted();
  return await readVerified(state.directory, validateRef(untrustedRef), signal);
};
