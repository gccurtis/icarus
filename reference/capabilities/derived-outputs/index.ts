// Derived Outputs — barrel export.
// Pattern follows structured-data/index.ts and context/index.ts.

export { createDerivedOutputService } from "./derived-outputs.js";
export type {
  DerivedOutputService,
  DerivedOutputConfig,
  ResourceReader,
  ResourceDescriptor,
  ResourceContent
} from "./derived-outputs.js";
export type {
  DerivedOutput,
  DerivedOutputKind,
  DerivedOutputDefinition,
  DerivedOutputRevision,
  DerivedOutputStatus,
  DerivedEvidence,
  DerivedEvidenceSpan,
  DerivedTextSpan,
  DerivedByteSpan,
  DerivedLineSpan,
  DerivedOutputFreshness,
  DerivedOutputRef,
  DeclareDerivedOutputRequest,
  DeclareDerivedOutputOptions,
  RefreshDerivedOutputOptions,
  UpdateDefinitionRequest,
  UpdateDerivedOutputDefinitionOptions,
  DerivedRefreshResult,
  RefreshAttempt,
  DerivedOutputChangeOperation
} from "./domain/model.js";
export {
  DerivedOutputNotFoundError,
  DerivedOutputConflictError,
  DerivedOutputIdempotencyConflictError,
  DerivedOutputRefreshIdempotencyConflictError,
  DerivedOutputDefinitionUpdateIdempotencyConflictError,
  StaleDefinitionRevisionError
} from "./domain/model.js";
export type { DerivedOutputStore } from "./store.js";
export { SQLiteDerivedOutputStore } from "./sqlite-store.js";
