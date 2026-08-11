import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { etcFile } from "#initialization/paths.js";
import type { BackendConfig } from "#initialization/configuration/types.js";
import { OPENROUTER_API_KEY_PLACEHOLDER } from "#initialization/configuration/types.js";
import { DEFAULT_CONFIG } from "#initialization/configuration/defaults.js";
import { parseBoolean, parseCastRoutes, parseNumber, parseString } from "#initialization/configuration/parse.js";
import {
  parseContextConfig, parseDerivedOutputConfig, parseDocumentConfig, parseFormulaConfig,
  parseRetentionConfig, parseRichTextLimitsConfig, parseStructuredDataConfig
} from "#initialization/configuration/capabilities.js";

export * from "#initialization/configuration/types.js";
export { DEFAULT_CONFIG } from "#initialization/configuration/defaults.js";

// Resolved through the imports map, so this file's own depth is irrelevant.
const defaultConfigPath = etcFile("configuration.yaml");

/**
 * Local overrides. Git-ignored, so this is where a real secret belongs. Absent on
 * a fresh checkout, which is not an error.
 */
const localConfigPath = etcFile("configuration.local.yaml");

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Overlay wins. Objects merge key by key; arrays and scalars replace outright, so
 * overriding a list of routes replaces it rather than appending to it.
 */
const merge = (
  base: Record<string, unknown>,
  overlay: Record<string, unknown>
): Record<string, unknown> => {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const existing = result[key];
    result[key] = isPlainObject(existing) && isPlainObject(value) ? merge(existing, value) : value;
  }
  return result;
};

/** Reads a YAML file, treating "not there" as absent rather than as a failure. */
const readYaml = async (path: string): Promise<Record<string, unknown> | undefined> => {
  let source: string;
  try {
    source = await readFile(path, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
  return (parse(source) as Record<string, unknown> | null) ?? {};
};

export const loadBackendConfig = async (
  configPath = defaultConfigPath,
  overridePath: string | undefined = localConfigPath
): Promise<BackendConfig> => {
  const base = await readYaml(configPath);
  if (base === undefined) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  const overlay = overridePath === undefined ? undefined : await readYaml(overridePath);
  const parsed = overlay === undefined ? base : merge(base, overlay);

  const server = (parsed.server as Record<string, unknown> | undefined) ?? {};
  const workerPool = (parsed.workerPool as Record<string, unknown> | undefined) ?? {};
  const queue = (parsed.queue as Record<string, unknown> | undefined) ?? {};
  const logging = (parsed.logging as Record<string, unknown> | undefined) ?? {};
  const intelligence =
    (parsed.intelligence as Record<string, unknown> | undefined) ?? {};
  const providers =
    (intelligence.providers as Record<string, unknown> | undefined) ?? {};
  const openrouter =
    (providers.openrouter as Record<string, unknown> | undefined) ?? {};
  const inference =
    (intelligence.inference as Record<string, unknown> | undefined) ?? {};
  const reasoning =
    (intelligence.reasoning as Record<string, unknown> | undefined) ?? {};
  const embedding =
    (intelligence.embedding as Record<string, unknown> | undefined) ?? {};
  const context = (parsed.context as Record<string, unknown> | undefined) ?? {};
  const derivedOutputs =
    (parsed.derivedOutputs as Record<string, unknown> | undefined) ?? {};
  const document =
    (parsed.document as Record<string, unknown> | undefined) ?? {};
  const retention =
    (parsed.retention as Record<string, unknown> | undefined) ?? {};
  const configuredOpenRouterApiKey = parseString(
    openrouter.apiKey,
    DEFAULT_CONFIG.intelligence.providers.openrouter.apiKey,
    "intelligence.providers.openrouter.apiKey"
  );

  const openRouterApiKeyFromEnv = process.env.OPENROUTER_API_KEY;
  const effectiveOpenRouterApiKey =
    configuredOpenRouterApiKey === OPENROUTER_API_KEY_PLACEHOLDER &&
    typeof openRouterApiKeyFromEnv === "string" &&
    openRouterApiKeyFromEnv.length > 0
      ? openRouterApiKeyFromEnv
      : configuredOpenRouterApiKey;

  return {
    server: {
      host: parseString(server.host, DEFAULT_CONFIG.server.host, "server.host"),
      port: parseNumber(server.port, DEFAULT_CONFIG.server.port, "server.port")
    },
    workerPool: {
      concurrentWorkers: parseNumber(
        workerPool.concurrentWorkers,
        DEFAULT_CONFIG.workerPool.concurrentWorkers,
        "workerPool.concurrentWorkers"
      )
    },
    queue: {
      serialMaxSize: parseNumber(
        queue.serialMaxSize,
        DEFAULT_CONFIG.queue.serialMaxSize,
        "queue.serialMaxSize"
      ),
      concurrentMaxSize: parseNumber(
        queue.concurrentMaxSize,
        DEFAULT_CONFIG.queue.concurrentMaxSize,
        "queue.concurrentMaxSize"
      )
    },
    logging: {
      enabled: parseBoolean(logging.enabled, DEFAULT_CONFIG.logging.enabled, "logging.enabled"),
      level: parseString(logging.level, DEFAULT_CONFIG.logging.level, "logging.level"),
      directory: parseString(
        logging.directory,
        DEFAULT_CONFIG.logging.directory,
        "logging.directory"
      )
    },
    intelligence: {
      providers: {
        openrouter: {
          apiKey: effectiveOpenRouterApiKey,
          baseUrl: parseString(
            openrouter.baseUrl,
            DEFAULT_CONFIG.intelligence.providers.openrouter.baseUrl,
            "intelligence.providers.openrouter.baseUrl"
          ),
          timeoutMs: parseNumber(
            openrouter.timeoutMs,
            DEFAULT_CONFIG.intelligence.providers.openrouter.timeoutMs,
            "intelligence.providers.openrouter.timeoutMs"
          )
        }
      },
      inference: {
        routes: parseCastRoutes(
          inference.routes,
          DEFAULT_CONFIG.intelligence.inference.routes,
          "intelligence.inference.routes"
        )
      },
      reasoning: {
        routes: parseCastRoutes(
          reasoning.routes,
          DEFAULT_CONFIG.intelligence.reasoning.routes,
          "intelligence.reasoning.routes"
        )
      },
      embedding: {
        provider: parseString(
          embedding.provider,
          DEFAULT_CONFIG.intelligence.embedding.provider,
          "intelligence.embedding.provider"
        ),
        model: parseString(
          embedding.model,
          DEFAULT_CONFIG.intelligence.embedding.model,
          "intelligence.embedding.model"
        )
      }
    },
    projectId: parseString(parsed.projectId, DEFAULT_CONFIG.projectId, "projectId"),
    userId: parseString(parsed.userId, DEFAULT_CONFIG.userId, "userId"),
    formula: parseFormulaConfig((parsed.formula as Record<string, unknown> | undefined) ?? {}, DEFAULT_CONFIG.formula),
    structuredData: parseStructuredDataConfig((parsed.structuredData as Record<string, unknown> | undefined) ?? {}, DEFAULT_CONFIG.structuredData),
    richText: parseRichTextLimitsConfig((parsed.richText as Record<string, unknown> | undefined) ?? {}, DEFAULT_CONFIG.richText),
    context: parseContextConfig(context, DEFAULT_CONFIG.context),
    derivedOutputs: parseDerivedOutputConfig(derivedOutputs, DEFAULT_CONFIG.derivedOutputs),
    document: parseDocumentConfig(document, DEFAULT_CONFIG.document),
    retention: parseRetentionConfig(retention, DEFAULT_CONFIG.retention)
  };
};
