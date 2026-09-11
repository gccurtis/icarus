import type { ConfigurationAdapter } from "$model/client/configuration/port";

/** The client adapters migrated to the runtime-owned port lifecycle. */
export type ClientModelAdapters = {
  readonly configuration: ConfigurationAdapter;
};
