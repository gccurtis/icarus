import { loadBackendConfig, type BackendConfig } from "#utils/config/loadBackendConfig.js";

export const createConfig = async (): Promise<BackendConfig> =>
  loadBackendConfig();
