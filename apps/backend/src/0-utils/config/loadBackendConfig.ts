import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

type IntelligenceTier = "low" | "medium" | "high";

const OPENROUTER_API_KEY_PLACEHOLDER = "replace-with-openrouter-api-key";

export interface IntelligenceCastRouteConfig {
  purpose: string;
  strength: IntelligenceTier;
  speed: IntelligenceTier;
  provider: string;
  model: string;
  effort?: IntelligenceTier;
}

export interface IntelligenceConfig {
  providers: {
    openrouter: {
      apiKey: string;
      baseUrl: string;
      timeoutMs: number;
    };
  };
  inference: {
    routes: IntelligenceCastRouteConfig[];
  };
  reasoning: {
    routes: IntelligenceCastRouteConfig[];
  };
  embedding: {
    provider: string;
    model: string;
  };
}

export interface BackendConfig {
  server: {
    host: string;
    port: number;
  };
  workerPool: {
    concurrentWorkers: number;
  };
  queue: {
    serialMaxSize: number;
    concurrentMaxSize: number;
  };
  logging: {
    enabled: boolean;
    level: string;
    directory: string;
  };
  intelligence: IntelligenceConfig;
  projectId: string;
}

const INTELLIGENCE_TIERS: IntelligenceTier[] = ["low", "medium", "high"];

const buildDefaultCastRoutes = (
  provider: string,
  model: string,
  effort: IntelligenceTier
): IntelligenceCastRouteConfig[] => {
  const routes: IntelligenceCastRouteConfig[] = [];

  for (const strength of INTELLIGENCE_TIERS) {
    for (const speed of INTELLIGENCE_TIERS) {
      routes.push({
        purpose: "general",
        strength,
        speed,
        provider,
        model,
        effort
      });
    }
  }

  return routes;
};

const DEFAULT_CONFIG: BackendConfig = {
  server: {
    host: "0.0.0.0",
    port: 4000
  },
  workerPool: {
    concurrentWorkers: 4
  },
  queue: {
    serialMaxSize: 1000,
    concurrentMaxSize: 1000
  },
  logging: {
    enabled: true,
    level: "info",
    directory: "logs"
  },
  intelligence: {
    providers: {
      openrouter: {
        apiKey: OPENROUTER_API_KEY_PLACEHOLDER,
        baseUrl: "https://openrouter.ai/api/v1",
        timeoutMs: 30000
      }
    },
    inference: {
      routes: buildDefaultCastRoutes("openrouter", "openai/gpt-4.1-mini", "low")
    },
    reasoning: {
      routes: buildDefaultCastRoutes("openrouter", "openai/gpt-4.1", "medium")
    },
    embedding: {
      provider: "openrouter",
      model: "openai/text-embedding-3-small"
    }
  },
  projectId: "default"
};

const moduleDir = dirname(fileURLToPath(import.meta.url));
const defaultConfigPath = resolve(moduleDir, "../../../etc/configuration.yaml");

const parseNumber = (value: unknown, fallback: number, fieldName: string): number => {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
    throw new Error(`Invalid '${fieldName}' value in backend configuration`);
  }

  return value;
};

const parseString = (value: unknown, fallback: string, fieldName: string): string => {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid '${fieldName}' value in backend configuration`);
  }

  return value;
};

const parseBoolean = (
  value: unknown,
  fallback: boolean,
  fieldName: string
): boolean => {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "boolean") {
    throw new Error(`Invalid '${fieldName}' value in backend configuration`);
  }

  return value;
};

const parseTier = (
  value: unknown,
  fallback: IntelligenceTier,
  fieldName: string
): IntelligenceTier => {
  if (value === undefined) {
    return fallback;
  }

  if (value !== "low" && value !== "medium" && value !== "high") {
    throw new Error(`Invalid '${fieldName}' value in backend configuration`);
  }

  return value;
};

const parseOptionalTier = (
  value: unknown,
  fallback: IntelligenceTier | undefined,
  fieldName: string
): IntelligenceTier | undefined => {
  if (value === undefined) {
    return fallback;
  }

  if (value !== "low" && value !== "medium" && value !== "high") {
    throw new Error(`Invalid '${fieldName}' value in backend configuration`);
  }

  return value;
};

const parseCastRoutes = (
  value: unknown,
  fallback: IntelligenceCastRouteConfig[],
  fieldName: string
): IntelligenceCastRouteConfig[] => {
  if (value === undefined) {
    return fallback.map((route) => ({ ...route }));
  }

  if (!Array.isArray(value)) {
    throw new Error(`Invalid '${fieldName}' value in backend configuration`);
  }

  return value.map((rawRoute, index) => {
    if (!rawRoute || typeof rawRoute !== "object" || Array.isArray(rawRoute)) {
      throw new Error(
        `Invalid '${fieldName}[${index}]' value in backend configuration`
      );
    }

    const route = rawRoute as Record<string, unknown>;
    const fallbackRoute = fallback[index] ?? fallback[0];

    if (!fallbackRoute) {
      throw new Error(`Invalid '${fieldName}' value in backend configuration`);
    }

    return {
      purpose: parseString(route.purpose, fallbackRoute.purpose, `${fieldName}[${index}].purpose`),
      strength: parseTier(
        route.strength,
        fallbackRoute.strength,
        `${fieldName}[${index}].strength`
      ),
      speed: parseTier(route.speed, fallbackRoute.speed, `${fieldName}[${index}].speed`),
      provider: parseString(
        route.provider,
        fallbackRoute.provider,
        `${fieldName}[${index}].provider`
      ),
      model: parseString(route.model, fallbackRoute.model, `${fieldName}[${index}].model`),
      effort: parseOptionalTier(
        route.effort,
        fallbackRoute.effort,
        `${fieldName}[${index}].effort`
      )
    };
  });
};

export const loadBackendConfig = async (configPath = defaultConfigPath): Promise<BackendConfig> => {
  const source = await readFile(configPath, "utf-8");
  const parsed = parse(source) as Record<string, unknown>;

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
    projectId: parseString(parsed.projectId, DEFAULT_CONFIG.projectId, "projectId")
  };
};
