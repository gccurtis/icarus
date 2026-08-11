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

export interface FormulaConfig {
  maxSourceBytes: number;
  maxTokens: number;
  maxNodes: number;
  maxDepth: number;
  maxSteps: number;
  maxCallDepth: number;
  maxFields: number;
  maxRows: number;
  maxCells: number;
  maxOutputBytes: number;
  maxIntegerBits: number;
  maxPowerMagnitude: number;
  maxRoundingPlaces: number;
}

export interface StructuredDataConfig {
  maxDisplayNameBytes: number;
  maxEntries: number;
  maxFieldsPerCollection: number;
  maxRowsPerCollection: number;
  maxBodyBytes: number;
}

export interface RichTextLimitsConfig {
  maxAtomsPerContent: number;
  maxMarksPerContent: number;
  maxMarkRangeSpan: number;
}

export interface ContextManagerConfig {
  maxEntriesPerContext: number;
  maxResolveDepth: number;
}

export interface DerivedOutputConfig {
  maxPlanQueries: number;
  maxToolRounds: number;
}

export interface DocumentConfig {
  history: {
    retainedBaseCount: number;
    retainedChangeSetCount: number;
    retainedTerminalAttemptCount: number;
  };
  limits: {
    maxRowsPerDocument: number;
    maxBlocksPerRow: number;
    maxStylesPerDocument: number;
    maxNestingDepth: number;
    maxAtomsPerBlockContent: number;
    maxTableRows: number;
    maxTableColumns: number;
  };
}

export interface RetentionConfig {
  /** Age after which superseded revisions and deleted resource histories expire. */
  revisionRetentionDays: number;
  /** Wall-clock cadence for the process-wide retention sweep. */
  sweepIntervalHours: number;
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
  formula: FormulaConfig;
  structuredData: StructuredDataConfig;
  richText: RichTextLimitsConfig;
  context: ContextManagerConfig;
  derivedOutputs: DerivedOutputConfig;
  document: DocumentConfig;
  retention: RetentionConfig;
  projectId: string;
  userId: string;
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
  projectId: "default",
  userId: "default-user",
  formula: {
    maxSourceBytes: 65536,
    maxTokens: 4096,
    maxNodes: 2048,
    maxDepth: 64,
    maxSteps: 1000000,
    maxCallDepth: 32,
    maxFields: 256,
    maxRows: 100000,
    maxCells: 1000000,
    maxOutputBytes: 1048576,
    maxIntegerBits: 4096,
    maxPowerMagnitude: 1000,
    maxRoundingPlaces: 20
  },
  structuredData: {
    maxDisplayNameBytes: 256,
    maxEntries: 10000,
    maxFieldsPerCollection: 256,
    maxRowsPerCollection: 100000,
    maxBodyBytes: 65536
  },
  richText: {
    maxAtomsPerContent: 10000,
    maxMarksPerContent: 5000,
    maxMarkRangeSpan: 1000
  },
  context: {
    maxEntriesPerContext: 100000,
    maxResolveDepth: 10
  },
  derivedOutputs: {
    maxPlanQueries: 8,
    maxToolRounds: 8
  },
  document: {
    history: {
      retainedBaseCount: 5,
      retainedChangeSetCount: 1000,
      retainedTerminalAttemptCount: 1000
    },
    limits: {
      maxRowsPerDocument: 10000,
      maxBlocksPerRow: 32,
      maxStylesPerDocument: 256,
      maxNestingDepth: 16,
      maxAtomsPerBlockContent: 10000,
      maxTableRows: 1000,
      maxTableColumns: 256
    }
  },
  retention: {
    revisionRetentionDays: 30,
    sweepIntervalHours: 24
  }
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

function parseFormulaConfig(raw: Record<string, unknown>, defaults: FormulaConfig): FormulaConfig {
  return {
    maxSourceBytes: parseNumber(raw.maxSourceBytes, defaults.maxSourceBytes, "formula.maxSourceBytes"),
    maxTokens: parseNumber(raw.maxTokens, defaults.maxTokens, "formula.maxTokens"),
    maxNodes: parseNumber(raw.maxNodes, defaults.maxNodes, "formula.maxNodes"),
    maxDepth: parseNumber(raw.maxDepth, defaults.maxDepth, "formula.maxDepth"),
    maxSteps: parseNumber(raw.maxSteps, defaults.maxSteps, "formula.maxSteps"),
    maxCallDepth: parseNumber(raw.maxCallDepth, defaults.maxCallDepth, "formula.maxCallDepth"),
    maxFields: parseNumber(raw.maxFields, defaults.maxFields, "formula.maxFields"),
    maxRows: parseNumber(raw.maxRows, defaults.maxRows, "formula.maxRows"),
    maxCells: parseNumber(raw.maxCells, defaults.maxCells, "formula.maxCells"),
    maxOutputBytes: parseNumber(raw.maxOutputBytes, defaults.maxOutputBytes, "formula.maxOutputBytes"),
    maxIntegerBits: parseNumber(raw.maxIntegerBits, defaults.maxIntegerBits, "formula.maxIntegerBits"),
    maxPowerMagnitude: parseNumber(raw.maxPowerMagnitude, defaults.maxPowerMagnitude, "formula.maxPowerMagnitude"),
    maxRoundingPlaces: parseNumber(raw.maxRoundingPlaces, defaults.maxRoundingPlaces, "formula.maxRoundingPlaces")
  };
}

function parseStructuredDataConfig(raw: Record<string, unknown>, defaults: StructuredDataConfig): StructuredDataConfig {
  return {
    maxDisplayNameBytes: parseNumber(raw.maxDisplayNameBytes, defaults.maxDisplayNameBytes, "structuredData.maxDisplayNameBytes"),
    maxEntries: parseNumber(raw.maxEntries, defaults.maxEntries, "structuredData.maxEntries"),
    maxFieldsPerCollection: parseNumber(raw.maxFieldsPerCollection, defaults.maxFieldsPerCollection, "structuredData.maxFieldsPerCollection"),
    maxRowsPerCollection: parseNumber(raw.maxRowsPerCollection, defaults.maxRowsPerCollection, "structuredData.maxRowsPerCollection"),
    maxBodyBytes: parseNumber(raw.maxBodyBytes, defaults.maxBodyBytes, "structuredData.maxBodyBytes")
  };
}

function parseContextConfig(raw: Record<string, unknown>, defaults: ContextManagerConfig): ContextManagerConfig {
  return {
    maxEntriesPerContext: parseNumber(raw.maxEntriesPerContext, defaults.maxEntriesPerContext, "context.maxEntriesPerContext"),
    maxResolveDepth: parseNumber(raw.maxResolveDepth, defaults.maxResolveDepth, "context.maxResolveDepth")
  };
}

function parseDerivedOutputConfig(raw: Record<string, unknown>, defaults: DerivedOutputConfig): DerivedOutputConfig {
  return {
    maxPlanQueries: parseNumber(raw.maxPlanQueries, defaults.maxPlanQueries, "derivedOutputs.maxPlanQueries"),
    maxToolRounds: parseNumber(raw.maxToolRounds, defaults.maxToolRounds, "derivedOutputs.maxToolRounds")
  };
}

function parseDocumentConfig(
  raw: Record<string, unknown>,
  defaults: DocumentConfig
): DocumentConfig {
  const history = (raw.history as Record<string, unknown> | undefined) ?? {};
  const limits = (raw.limits as Record<string, unknown> | undefined) ?? {};

  return {
    history: {
      retainedBaseCount: parseNumber(
        history.retainedBaseCount,
        defaults.history.retainedBaseCount,
        "document.history.retainedBaseCount"
      ),
      retainedChangeSetCount: parseNumber(
        history.retainedChangeSetCount,
        defaults.history.retainedChangeSetCount,
        "document.history.retainedChangeSetCount"
      ),
      retainedTerminalAttemptCount: parseNumber(
        history.retainedTerminalAttemptCount,
        defaults.history.retainedTerminalAttemptCount,
        "document.history.retainedTerminalAttemptCount"
      )
    },
    limits: {
      maxRowsPerDocument: parseNumber(
        limits.maxRowsPerDocument,
        defaults.limits.maxRowsPerDocument,
        "document.limits.maxRowsPerDocument"
      ),
      maxBlocksPerRow: parseNumber(
        limits.maxBlocksPerRow,
        defaults.limits.maxBlocksPerRow,
        "document.limits.maxBlocksPerRow"
      ),
      maxStylesPerDocument: parseNumber(
        limits.maxStylesPerDocument,
        defaults.limits.maxStylesPerDocument,
        "document.limits.maxStylesPerDocument"
      ),
      maxNestingDepth: parseNumber(
        limits.maxNestingDepth,
        defaults.limits.maxNestingDepth,
        "document.limits.maxNestingDepth"
      ),
      maxAtomsPerBlockContent: parseNumber(
        limits.maxAtomsPerBlockContent,
        defaults.limits.maxAtomsPerBlockContent,
        "document.limits.maxAtomsPerBlockContent"
      ),
      maxTableRows: parseNumber(
        limits.maxTableRows,
        defaults.limits.maxTableRows,
        "document.limits.maxTableRows"
      ),
      maxTableColumns: parseNumber(
        limits.maxTableColumns,
        defaults.limits.maxTableColumns,
        "document.limits.maxTableColumns"
      )
    }
  };
}

function parseRetentionConfig(
  raw: Record<string, unknown>,
  defaults: RetentionConfig
): RetentionConfig {
  return {
    revisionRetentionDays: parseNumber(
      raw.revisionRetentionDays,
      defaults.revisionRetentionDays,
      "retention.revisionRetentionDays"
    ),
    sweepIntervalHours: parseNumber(
      raw.sweepIntervalHours,
      defaults.sweepIntervalHours,
      "retention.sweepIntervalHours"
    )
  };
}

function parseRichTextLimitsConfig(raw: Record<string, unknown>, defaults: RichTextLimitsConfig): RichTextLimitsConfig {
  return {
    maxAtomsPerContent: parseNumber(raw.maxAtomsPerContent, defaults.maxAtomsPerContent, "richText.maxAtomsPerContent"),
    maxMarksPerContent: parseNumber(raw.maxMarksPerContent, defaults.maxMarksPerContent, "richText.maxMarksPerContent"),
    maxMarkRangeSpan: parseNumber(raw.maxMarkRangeSpan, defaults.maxMarkRangeSpan, "richText.maxMarkRangeSpan")
  };
}
