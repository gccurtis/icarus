import type { Id } from "$representation/data/types/core/id";

import { acquireMutation } from "$model/server/external-file-storage/methods/acquire-mutation";
import { claimPublication } from "$model/server/external-file-storage/methods/claim-publication";
import { discardPublication } from "$model/server/external-file-storage/methods/discard-publication";
import { put } from "$model/server/external-file-storage/methods/put";
import { read } from "$model/server/external-file-storage/methods/read";
import { reconcile } from "$model/server/external-file-storage/methods/reconcile";
import { releaseClaim } from "$model/server/external-file-storage/methods/release-claim";
import { remove } from "$model/server/external-file-storage/methods/remove";
import type {
  ExternalFileStorageClaim,
  ExternalFileStorageFailpoint,
  ExternalFileStorageModel,
  ExternalFileStoragePutInput,
  ExternalFileStorageReceipt,
  ExternalFileStorageReconciliation,
  ExternalFileStorageRef,
  ExternalFileStorageRemoval
} from "$model/server/external-file-storage/types";

export type ExternalFileStorageState = {
  readonly directory: string;
  readonly failpoint?: (point: ExternalFileStorageFailpoint) => void;
  mutationTail: Promise<void>;
};

/** Owns one native repository. Public behavior delegates into methods/. */
export class ExternalFileStorage implements ExternalFileStorageModel {
  readonly #state: ExternalFileStorageState;

  constructor(
    directory: string,
    failpoint?: (point: ExternalFileStorageFailpoint) => void
  ) {
    this.#state = { directory, failpoint, mutationTail: Promise.resolve() };
  }

  readonly acquireMutation = (): Promise<() => void> => acquireMutation(this.#state);

  readonly put = (input: ExternalFileStoragePutInput): Promise<ExternalFileStorageReceipt> =>
    put(this.#state, input);

  readonly claimPublication = (
    receipt: ExternalFileStorageReceipt,
    ownerId: Id<"externalFiles">
  ): Promise<void> => claimPublication(this.#state, receipt, ownerId);

  readonly discardPublication = (receipt: ExternalFileStorageReceipt): Promise<void> =>
    discardPublication(this.#state, receipt);

  readonly releaseClaim = (claim: ExternalFileStorageClaim): Promise<void> =>
    releaseClaim(this.#state, claim);

  readonly read = (
    ref: ExternalFileStorageRef,
    signal?: AbortSignal
  ): Promise<Uint8Array | undefined> => read(this.#state, ref, signal);

  readonly remove = (ref: ExternalFileStorageRef): Promise<ExternalFileStorageRemoval> =>
    remove(this.#state, ref);

  readonly reconcile = (
    references: readonly ExternalFileStorageClaim[]
  ): Promise<ExternalFileStorageReconciliation> => reconcile(this.#state, references);
}

export const defineExternalFileStorage = (
  directory: string,
  failpoint?: (point: ExternalFileStorageFailpoint) => void
): ExternalFileStorageModel => new ExternalFileStorage(directory, failpoint);
