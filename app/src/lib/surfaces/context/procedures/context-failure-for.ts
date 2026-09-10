import type { ContextFailure } from "$surfaces/context/shared/context-state.svelte";

/** A failure is presentable only under the route whose import produced it. */
export const contextFailureFor = (
  failure: ContextFailure | undefined,
  path: string | undefined
): ContextFailure | undefined => failure?.path === path ? failure : undefined;
