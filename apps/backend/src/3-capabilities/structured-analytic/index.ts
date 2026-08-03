export {
  createStructuredAnalyticService,
  type StructuredAnalyticService,
  type StructuredAnalyticServiceDependencies
} from "./application/structuredAnalyticService.js";

export {
  AnalyticCompilationError,
  AnalyticConfigurationError,
  AnalyticNameConflictError,
  AnalyticNotFoundError,
  AnalyticPullError,
  AnalyticValidationError,
  AnalyticWireError,
  StaleAnalyticRevisionError,
  type AnalyticPullFailureReason
} from "./domain/errors.js";

export {
  DEFAULT_STRUCTURED_ANALYTIC_LIMITS,
  STRUCTURED_ANALYTIC_LIMIT_KEYS,
  inputKey,
  placementName,
  type AnalyticCheck,
  type AnalyticCommand,
  type AnalyticCommandResult,
  type AnalyticDefinition,
  type AnalyticPull,
  type AnalyticQuery,
  type AnalyticQueryResult,
  type AnalyticScalar,
  type AnalyticSourceRead,
  type AnalyticResultField,
  type StructuredAnalytic,
  type StructuredAnalyticLimits
} from "./domain/model.js";

export { compileToSource, compileDefinition } from "./domain/compile.js";
export { validateAnalyticLimits } from "./domain/validation.js";

export type { ProjectData, ProjectEntryMetadata } from "./ports/projectData.js";
export type { StructuredDataWriter } from "./ports/structuredDataWriter.js";
export type { StructuredAnalyticStore } from "./ports/structuredAnalyticStore.js";

export {
  AnalyticIdRetiredError,
  CorruptAnalyticRowError,
  SQLiteStructuredAnalyticStore
} from "./persistence/sqliteStructuredAnalyticStore.js";

export { decodeAnalyticCommand } from "./wire/commandSchemas.js";
export { decodeAnalyticQuery } from "./wire/querySchemas.js";
