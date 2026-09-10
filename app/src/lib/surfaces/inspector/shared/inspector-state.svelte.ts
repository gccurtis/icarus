import type { Component } from "svelte";

export type LensModule = { readonly default: Component };
export type LensLoader = () => Promise<LensModule>;
export type LensFailure = { readonly path: string; readonly reason: string };

/** The dynamic lens owned by one mounted inspector surface. */
export class InspectorState {
  lens = $state<Component>();
  loadedPath = $state<string>();
  failure = $state<LensFailure>();
}
