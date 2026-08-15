import type { Configuration, ConfigurationObject } from "$model/server/configuration/types";
import { get } from "$model/server/configuration/methods/get";

/**
 * One frozen snapshot, loaded at startup and never reloaded.
 *
 * The tree arrives already merged and frozen from the constructor, so this holds
 * a value nothing can change rather than a file it might re-read. That is the
 * whole of its state, and the reason reading configuration is synchronous
 * everywhere else in the process.
 */
export class SnapshotConfiguration implements Configuration {
  readonly #root: ConfigurationObject;

  constructor(root: ConfigurationObject) {
    this.#root = root;
  }

  get(key: string): unknown {
    return get(this.#root, key);
  }
}
