import { link, mkdir, open, rm } from "node:fs/promises";
import { join } from "node:path";

import type { ExternalFileStorageState } from "$model/server/external-file-storage/definition";
import type {
  ExternalFileStoragePutInput,
  ExternalFileStorageReceipt,
  ExternalFileStorageRef
} from "$model/server/external-file-storage/types";
import { readVerified, syncDirectory } from "$model/server/external-file-storage/methods/shared/io";
import { publicationName } from "$model/server/external-file-storage/methods/shared/names";
import { validatePut } from "$model/server/external-file-storage/methods/shared/validation";

const linkCanonical = async (
  directory: string,
  token: string,
  admitted: ExternalFileStorageRef
): Promise<boolean> => {
  try {
    await link(join(directory, token), join(directory, admitted.hash));
    return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    if (await readVerified(directory, admitted) === undefined) {
      throw new Error("the canonical external file disappeared during publication");
    }
    return true;
  }
};

/** Durably publishes admitted bytes while retaining a recovery copy. */
export const put = async (
  state: ExternalFileStorageState,
  input: ExternalFileStoragePutInput
): Promise<ExternalFileStorageReceipt> => {
  const admitted = validatePut(input);
  await mkdir(state.directory, { recursive: true });
  const publicationToken = publicationName(admitted.hash);
  let file;
  let recoveryReady = false;
  try {
    file = await open(join(state.directory, publicationToken), "wx", 0o600);
    await file.writeFile(input.bytes);
    await file.sync();
    await file.close();
    file = undefined;
    recoveryReady = true;
    state.failpoint?.("put:after-temporary");
    const reused = await linkCanonical(state.directory, publicationToken, admitted);
    await syncDirectory(state.directory);
    state.failpoint?.("put:after-publish");
    return { ...admitted, reused, publicationToken };
  } finally {
    await file?.close();
    if (!recoveryReady) await rm(join(state.directory, publicationToken), { force: true });
  }
};
