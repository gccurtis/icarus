import type { Component } from "svelte";

export type CentreModule = { readonly default: Component };
export type CentreLoader = () => Promise<CentreModule>;
export type CentreFailure = { readonly path: string; readonly reason: string };

/**
 * The dynamic centre load owned by one mounted content surface.
 *
 * A resolved component is inseparable from the path that produced it. Keeping
 * both in one instance ledger prevents a tab change from mounting yesterday's
 * component against today's workspace subject while the next import starts.
 */
export class ContentState {
  centre = $state<Component>();
  loadedPath = $state<string>();
  missing = $state<string>();
  failure = $state<CentreFailure>();
}
