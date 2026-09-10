import type { CentreFailure } from "$surfaces/content/shared/content-state.svelte";

/** A failure is presentable only under the route whose import produced it. */
export const centreFailureFor = (
  failure: CentreFailure | undefined,
  path: string
): CentreFailure | undefined => failure?.path === path ? failure : undefined;
