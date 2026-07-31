import type { BackendConfig } from "#utils/config/loadBackendConfig.js";
import { Intelligence } from "#platform/intelligence/intelligence.js";
import { OpenRouterProvider } from "#platform/intelligence/openrouter/provider.js";

export const createIntelligence = (config: BackendConfig): Intelligence => {
  const openRouterProvider = new OpenRouterProvider(config.intelligence.providers.openrouter);

  return new Intelligence(config.intelligence, {
    [openRouterProvider.name()]: openRouterProvider
  });
};
