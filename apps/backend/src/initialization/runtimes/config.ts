import { loadBackendConfig, type BackendConfig } from "#initialization/configuration/index.js";

export const createConfig = async (): Promise<BackendConfig> =>
  loadBackendConfig();
