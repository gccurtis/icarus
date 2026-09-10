import type { LensFailure } from "$surfaces/inspector/shared/inspector-state.svelte";

/** A failure is presentable only under the route whose import produced it. */
export const lensFailureFor = (
  failure: LensFailure | undefined,
  path: string | undefined
): LensFailure | undefined => failure?.path === path ? failure : undefined;
