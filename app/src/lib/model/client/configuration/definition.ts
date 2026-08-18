import { get } from "$model/client/configuration/methods/get";
import type { ConfigurationModel, ConfigurationSnapshot } from "$model/client/configuration/types";

/**
 * One snapshot, received at construction and never refetched.
 *
 * `.ts` rather than `.svelte.ts` because nothing here changes: the values arrive
 * with the layout's load data and are fixed for the life of the client instance.
 * A reader that had to be reactive would be reacting to something that cannot
 * happen, and reloading configuration means reloading the page.
 *
 * Public calls delegate to `methods/`, which is what keeps this file the surface
 * rather than the traversal behind it.
 */
export class Configuration implements ConfigurationModel {
  readonly #root: ConfigurationSnapshot;

  constructor(root: ConfigurationSnapshot) {
    this.#root = root;
  }

  get(key: string): unknown {
    return get(this.#root, key);
  }
}
