/** Configuration shapes. Sections for capabilities that currently live in
 * `reference/` are kept so their config survives the rebuild. */
export type IntelligenceTier = "low" | "medium" | "high";

export const OPENROUTER_API_KEY_PLACEHOLDER = "replace-with-openrouter-api-key";

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

export const INTELLIGENCE_TIERS: IntelligenceTier[] = ["low", "medium", "high"];
