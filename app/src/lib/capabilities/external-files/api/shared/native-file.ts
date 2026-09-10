import { createHash } from "node:crypto";

import { asId } from "$representation/data/behavior/core/id";
import {
  fileSubkindFor,
  mediaTypeForExternalBytes
} from "$representation/data/behavior/external/file";
import type { Id } from "$representation/data/types/core/id";
import type { FileSubkind } from "$representation/data/types/external/file";
import type { ServerModel } from "$runtime/server/start.server";
import type {
  ExternalFileStorageReceipt,
  ExternalFileStorageRef
} from "$model/server/external-file-storage/index.server";
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

export type ExternalBlobCleanup =
  | "removed"
  | "shared"
  | "already-missing"
  | "retained-after-error";

/** Makes a successful Store row a durable native-byte claimant. */
export const claimExternalPublication = async (
  model: ServerModel,
  receipt: ExternalFileStorageReceipt,
  ownerId: Id<"externalFiles">
): Promise<boolean> => {
  try {
    await model.externalFileStorage.claimPublication(receipt, ownerId);
    return true;
  } catch {
    // The fsynced publication remains recoverable. Startup reconciliation runs
    // after Store journal recovery and will rebuild the row claim.
    return false;
  }
};

/** Removes only the recovery copy for a publication whose Store intent lost. */
export const discardExternalPublication = async (
  model: ServerModel,
  receipt: ExternalFileStorageReceipt
): Promise<boolean> => {
  try {
    await model.externalFileStorage.discardPublication(receipt);
    return true;
  } catch {
    return false;
  }
};

/** Releases one row's durable native claim after row deletion/replacement. */
export const releaseExternalBlobClaim = async (
  model: ServerModel,
  ownerId: Id<"externalFiles">,
  reference: ExternalFileStorageRef
): Promise<boolean> => {
  try {
    await model.externalFileStorage.releaseClaim({ ...reference, ownerId });
    return true;
  } catch {
    return false;
  }
};

/**
 * Resolves the ambiguous exception boundary around Store commit. A readable
 * committed row adopts the publication; a readable rollback discards it; an
 * unavailable post-commit Store leaves the recovery copy for restart.
 */
export const settleExternalPublicationAfterStoreFailure = async (
  model: ServerModel,
  receipt: ExternalFileStorageReceipt
): Promise<void> => {
  try {
    const owners = rowsOf(model.store, "externalFiles").filter(
      (row) => row.storageId === receipt.storageId && row.hash === receipt.hash
    );
    if (owners.length > 0) {
      for (const owner of owners) {
        await claimExternalPublication(model, receipt, owner._id);
      }
      return;
    }
    await discardExternalPublication(model, receipt);
    await cleanupExternalBlobIfUnreferenced(model, receipt);
  } catch {
    // A post-decision Store intentionally withholds reads. The recovery copy is
    // the durable handoff to startup reconciliation.
  }
};

/** Idempotent post-transaction reclamation; represented claims always win. */
export const cleanupExternalBlobIfUnreferenced = async (
  model: ServerModel,
  reference: ExternalFileStorageRef
): Promise<ExternalBlobCleanup> => {
  try {
    if (rowsOf(model.store, "externalFiles").some(
      (row) => row.storageId === reference.storageId && row.hash === reference.hash
    )) return "shared";
    const removal = await model.externalFileStorage.remove(reference);
    if (removal === "claimed") return "shared";
    return removal;
  } catch {
    // A Store interrupted after durable journal commit is deliberately
    // unavailable. Retaining the blob lets startup recovery discover the row
    // before reconciliation decides whether the value is actually orphaned.
    return "retained-after-error";
  }
};
