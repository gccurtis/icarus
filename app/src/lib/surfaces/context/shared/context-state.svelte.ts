import type { Component } from "svelte";

export type ContextModule = { readonly default: Component };
export type ContextLoader = () => Promise<ContextModule>;
export type ContextFailure = { readonly path: string; readonly reason: string };

/** The dynamic context view owned by one mounted left-hand panel. */
export class ContextState {
  content = $state<Component>();
  loadedPath = $state<string>();
  failure = $state<ContextFailure>();
}
