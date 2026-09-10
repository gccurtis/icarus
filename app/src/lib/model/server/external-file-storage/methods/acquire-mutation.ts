import type { ExternalFileStorageState } from "$model/server/external-file-storage/definition";

/** Queues one process-local mutation and returns its release handle. */
export const acquireMutation = async (
  state: ExternalFileStorageState
): Promise<() => void> => {
  const previous = state.mutationTail;
  let release = (): void => undefined;
  state.mutationTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  return release;
};
