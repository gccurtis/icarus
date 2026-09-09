import { createHash } from "node:crypto";

import { asId } from "$representation/data/behavior/core/id";
import {
  fileSubkindFor,
  mediaTypeForExternalBytes
} from "$representation/data/behavior/external/file";
import type { Id } from "$representation/data/types/core/id";
import type { FileSubkind } from "$representation/data/types/external/file";
import type { ServerModel } from "$runtime/server/start.server";
import type { ExternalFileStorageReceipt } from "$model/server/external-file-storage/index.server";
import { rowsOf } from "$capabilities/external-files/api/shared/rows";

/** Complete server-derived native descriptor. Browser metadata is only a hint. */
export type AdmittedNativeFile = {
  readonly storageId: Id<"_storage">;
  readonly hash: string;
  readonly size: number;
  readonly mediaType: string;
  readonly subkind: FileSubkind;
};

/** External owns byte identity and classification before delegating physical I/O. */
export const admitNativeFile = (
  bytes: Uint8Array,
  declaredMediaType: string,
  name: string
): AdmittedNativeFile => {
  const hash = createHash("sha256").update(bytes).digest("hex");
  const mediaType = mediaTypeForExternalBytes(bytes, declaredMediaType, name);
  return {
    storageId: asId<"_storage">(`_storage:${hash}`),
    hash,
    size: bytes.byteLength,
    mediaType,
    subkind: fileSubkindFor(mediaType, name)
  };
};

/** Best-effort compensation for bytes published before a represented row claims them. */
export const releaseUnclaimedNativeFile = async (
  model: ServerModel,
  receipt: ExternalFileStorageReceipt
): Promise<void> => {
  if (
    receipt.reused ||
    rowsOf(model.store, "externalFiles").some((row) => row.hash === receipt.hash)
  ) return;
  try {
    await model.externalFileStorage.remove(receipt);
  } catch {
    // A content-addressed orphan is safer than converting a recoverable row
    // refusal into a failed request. A later upload can reclaim the hash.
  }
};
