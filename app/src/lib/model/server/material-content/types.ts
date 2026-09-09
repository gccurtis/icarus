import type { Id } from "$representation/data/types/core/id";

export type MaterialContentRef = {
  storageId: Id<"_storage">;
  hash: string;
};

export type MaterialContentReceipt = MaterialContentRef & {
  readonly size: number;
  /** True when the addressed bytes were already present and verified. */
  readonly reused: boolean;
};

export type MaterialContentPutInput = {
  readonly bytes: Uint8Array;
  /** A caller-owned ceiling repeated at the byte authority as defence in depth. */
  readonly maxBytes?: number;
};

/** Native byte authority. An object-store adapter can implement this same port. */
export interface MaterialContentModel {
  /**
   * Serializes a native-content mutation with the represented row mutation
   * coordinated by its caller. The returned release must run in `finally`.
   */
  acquireMutation(): Promise<() => void>;
  put(input: MaterialContentPutInput): Promise<MaterialContentReceipt>;
  read(ref: MaterialContentRef): Promise<Uint8Array | undefined>;
  /** Idempotently removes one known content-addressed value. */
  remove(ref: MaterialContentRef): Promise<boolean>;
}
