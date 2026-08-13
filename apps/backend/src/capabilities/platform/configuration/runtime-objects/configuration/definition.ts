import type { ConfigurationObject } from "#configuration/types/configuration-object.js";
import { getConfigurationValue } from "#configuration/runtime-api/get/get.js";

/**
 * The backend's configuration snapshot. Every consumer reads its keys through
 * this port and owns the validation rules for the values it reads.
 */
export interface Configuration {
  get(key: string): unknown;
}

/** Reads one frozen snapshot loaded at startup. It is never reloaded. */
export class SnapshotConfiguration implements Configuration {
  constructor(private readonly root: ConfigurationObject) {}

  get(key: string): unknown {
    return getConfigurationValue(this.root, key);
  }
}
