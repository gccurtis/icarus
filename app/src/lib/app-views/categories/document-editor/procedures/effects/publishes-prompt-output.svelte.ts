import { untrack } from "svelte";

import type { DerivedOutput } from "$representation/data/types/semantic/derived-output";

const publicationKey = (output: DerivedOutput): string =>
  `${output._id}:${output.lastRevision}:${output.updatedAt}:${output.state}`;

/** Reconciles each newly observed publication once, including results that outlive their request. */
export const publishesPromptOutput = ({
  output,
  publish,
  fail
}: {
  readonly output: () => DerivedOutput | undefined;
  readonly publish: (output: DerivedOutput) => Promise<void>;
  readonly fail: (error: unknown) => void;
}): void => {
  let attempted: string | undefined;

  $effect(() => {
    const current = output();
    if (current === undefined) return;
    const key = publicationKey(current);
    if (key === attempted) return;
    attempted = key;

    void untrack(() => publish(current)).catch((error: unknown) => {
      attempted = undefined;
      fail(error);
    });
  });
};
