import type { Id } from "$representation/data/types/core/id";

export type ExternalFileStorageRef = {
  readonly storageId: Id<"_storage">;
  readonly hash: string;
  /** Optional for legacy represented rows that predate recorded byte size. */
  readonly size?: number;
};

export type ExternalFileStoragePutInput = ExternalFileStorageRef & {
  readonly bytes: Uint8Array;
  /** The External capability repeats its admission ceiling at the I/O boundary. */
  readonly maxBytes?: number;
};

export type ExternalFileStorageReceipt = Required<ExternalFileStorageRef> & {
  /** True when verified bytes already existed in the primary or legacy repository. */
  readonly reused: boolean;
};

/** External's native-byte repository. It never classifies files or authors metadata. */
export interface ExternalFileStorageModel {
  /**
   * Serializes an External mutation that spans native bytes and represented rows.
   * The returned release must run in `finally`.
   */
  acquireMutation(): Promise<() => void>;
  /** Stores only an External-admitted descriptor and verifies it defensively. */
  put(input: ExternalFileStoragePutInput): Promise<ExternalFileStorageReceipt>;
  /** Reads and verifies the descriptor supplied by the owning External capability. */
  read(ref: ExternalFileStorageRef): Promise<Uint8Array | undefined>;
  /** Idempotently removes the addressed value from primary and legacy repositories. */
  remove(ref: ExternalFileStorageRef): Promise<boolean>;
}
