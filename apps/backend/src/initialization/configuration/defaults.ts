import type { BackendConfig, IntelligenceCastRouteConfig, IntelligenceTier } from "./types.js";
import { OPENROUTER_API_KEY_PLACEHOLDER, INTELLIGENCE_TIERS } from "./types.js";

export const buildDefaultCastRoutes = (
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

export const DEFAULT_CONFIG: BackendConfig = {
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
