import { mkdir, readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";

import type { ExternalFileStorageState } from "$model/server/external-file-storage/definition";
import type {
  ExternalFileStorageRef,
  ExternalFileStorageRemoval
} from "$model/server/external-file-storage/types";
import {
  readVerified,
  restoreCanonicalFrom,
  syncDirectory
} from "$model/server/external-file-storage/methods/shared/io";
import { garbageName } from "$model/server/external-file-storage/methods/shared/names";
import { validateRef } from "$model/server/external-file-storage/methods/shared/validation";

const isProtected = async (directory: string, hash: string): Promise<boolean> =>
  (await readdir(directory)).some((name) =>
    name.startsWith(`.claim.${hash}.`) || name.startsWith(`.publish.${hash}.`)
  );

export const remove = async (
  state: ExternalFileStorageState,
  untrustedRef: ExternalFileStorageRef
): Promise<ExternalFileStorageRemoval> => {
  const ref = validateRef(untrustedRef);
  await mkdir(state.directory, { recursive: true });
  const quarantined = garbageName(ref.hash);
  try {
    await rename(join(state.directory, ref.hash), join(state.directory, quarantined));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return await isProtected(state.directory, ref.hash) ? "claimed" : "already-missing";
  }
  await syncDirectory(state.directory);
  state.failpoint?.("remove:after-quarantine");

  if (await isProtected(state.directory, ref.hash)) {
    if (await readVerified(state.directory, ref) === undefined) {
      await restoreCanonicalFrom(state.directory, quarantined, ref);
    }
    await rm(join(state.directory, quarantined), { force: true });
    await syncDirectory(state.directory);
    return "claimed";
  }
  await rm(join(state.directory, quarantined), { force: true });
  await syncDirectory(state.directory);
  return "removed";
};
