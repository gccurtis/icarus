import {
  requiredString,
  type Configuration
} from "$model/server/configuration/index.server";
import { defineIntelligence } from "$model/server/intelligence/definition";
import type {
  IntelligenceConfiguration,
  IntelligenceModel
} from "$model/server/intelligence/types";

const ROOT = "intelligence";
const OPENROUTER = `${ROOT}.providers.openrouter`;

const positiveInteger = (configuration: Configuration, key: string): number => {
  const value = configuration.get(key);
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new Error(`Configuration key '${key}' must be a positive integer`);
  }
  return value as number;
};

const endpoint = (configuration: Configuration): string => {
  const key = `${OPENROUTER}.endpoint`;
  const value = requiredString(configuration, key);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch (error) {
    throw new Error(`Configuration key '${key}' must be an HTTP URL`, { cause: error });
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Configuration key '${key}' must be an HTTP URL`);
  }
  return parsed.toString();
};

const effort = (
  configuration: Configuration
): IntelligenceConfiguration["reasoningEffort"] => {
  const key = `${OPENROUTER}.reasoningEffort`;
  const value = requiredString(configuration, key);
  if (value !== "low" && value !== "medium" && value !== "high") {
    throw new Error(`Configuration key '${key}' must be 'low', 'medium', or 'high'`);
  }
  return value;
};

/**
 * A fresh intelligence. Caches nothing — the runtime holds the one instance, and a
 * second caller here would be a second graph over the same state.
 */
export const createIntelligence = (configuration: Configuration): IntelligenceModel => {
  const api = requiredString(configuration, `${ROOT}.api`);
  if (api !== "openrouter") {
    throw new Error(`Configuration key '${ROOT}.api' must be 'openrouter'`);
  }

  return defineIntelligence({
    apiKey: requiredString(configuration, `${OPENROUTER}.apiKey`),
    endpoint: endpoint(configuration),
    model: requiredString(configuration, `${OPENROUTER}.model`),
    timeoutMs: positiveInteger(configuration, `${OPENROUTER}.timeoutMs`),
    maxOutputTokens: positiveInteger(configuration, `${OPENROUTER}.maxOutputTokens`),
    reasoningEffort: effort(configuration),
    maxToolRounds: positiveInteger(configuration, `${ROOT}.agent.maxToolRounds`)
  });
};
