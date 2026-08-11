import { loadBackendConfig, type BackendConfig } from "#initialization/configuration.js";

export const createConfig = async (): Promise<BackendConfig> =>
  loadBackendConfig();
