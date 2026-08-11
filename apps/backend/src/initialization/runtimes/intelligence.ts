import type { BackendConfig } from "#initialization/configuration.js";
import type { Logger } from "#capabilities/observability/logger.js";
import { Intelligence } from "#capabilities/intelligence/intelligence.js";
import { OpenRouterProvider } from "#capabilities/intelligence/openrouter/provider.js";

export const createIntelligence = (config: BackendConfig, logger: Logger): Intelligence => {
  const openRouterProvider = new OpenRouterProvider(config.intelligence.providers.openrouter);

  return new Intelligence(config.intelligence, {
    [openRouterProvider.name()]: openRouterProvider
  }, logger);
};
