import type { Id } from "$representation/data/types/core/id";

export type ExternalFileStorageRef = {
  readonly storageId: Id<"_storage">;
  readonly hash: string;
  readonly size: number;
};

export type ExternalFileStoragePutInput = ExternalFileStorageRef & {
  readonly bytes: Uint8Array;
  /** The External capability repeats its admission ceiling at the I/O boundary. */
  readonly maxBytes: number;
};

export type ExternalFileStorageReceipt = Required<ExternalFileStorageRef> & {
  /** True when verified bytes already existed in the current repository. */
  readonly reused: boolean;
  /** Opaque handle for the durable recovery copy held until its row is claimed. */
  readonly publicationToken: string;
};

export type ExternalFileStorageClaim = ExternalFileStorageRef & {
  readonly ownerId: Id<"externalFiles">;
};

export type ExternalFileStorageRemoval = "removed" | "claimed" | "already-missing";

export type ExternalFileStorageReconciliation = {
  readonly removedTemporaryFiles: number;
  readonly removedOrphanBlobs: number;
  readonly retainedBlobs: number;
};

export type ExternalFileStorageFailpoint =
  | "put:after-temporary"
  | "put:after-publish"
  | "remove:after-quarantine";

/** External's native-byte repository. It never classifies files or authors metadata. */
export interface ExternalFileStorageModel {
  /**
   * Serializes an External mutation that spans native bytes and represented rows.
   * The returned release must run in `finally`.
   */
  acquireMutation(): Promise<() => void>;
  /** Stores only an External-admitted descriptor and verifies it defensively. */
  put(input: ExternalFileStoragePutInput): Promise<ExternalFileStorageReceipt>;
  /** Converts a published recovery copy into a durable claim for its represented row. */
  claimPublication(
    receipt: ExternalFileStorageReceipt,
    ownerId: Id<"externalFiles">
  ): Promise<void>;
  /** Drops an uncommitted recovery copy. Canonical bytes remain eligible for GC. */
  discardPublication(receipt: ExternalFileStorageReceipt): Promise<void>;
  /** Releases one represented row's claim after its Store transaction commits. */
  releaseClaim(claim: ExternalFileStorageClaim): Promise<void>;
  /** Reads and verifies the descriptor supplied by the owning External capability. */
  read(ref: ExternalFileStorageRef, signal?: AbortSignal): Promise<Uint8Array | undefined>;
  /** Idempotently removes the addressed value from the current repository. */
  remove(ref: ExternalFileStorageRef): Promise<ExternalFileStorageRemoval>;
  /** Removes interrupted publications and blobs no represented External row owns. */
  reconcile(
    references: readonly ExternalFileStorageClaim[]
  ): Promise<ExternalFileStorageReconciliation>;
}
