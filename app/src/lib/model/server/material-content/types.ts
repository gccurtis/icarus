import type { Id } from "$representation/data/types/core/id";

export type MaterialContentRef = {
  storageId: Id<"_storage">;
  hash: string;
};

/** Native byte authority. A future upload/object-store adapter implements this same port. */
export interface MaterialContentModel {
  read(ref: MaterialContentRef, signal?: AbortSignal): Promise<Uint8Array | undefined>;
}
