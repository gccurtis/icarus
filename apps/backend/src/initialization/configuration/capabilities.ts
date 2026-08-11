import type {
  ContextManagerConfig, DerivedOutputConfig, DocumentConfig, FormulaConfig,
  RetentionConfig, RichTextLimitsConfig, StructuredDataConfig
} from "./types.js";
import { parseBoolean, parseNumber, parseOptionalTier, parseString, parseTier } from "./parse.js";

/** Per-capability section parsing. Each moves to its capability as that
 * capability returns from `reference/`. */

export function parseFormulaConfig(raw: Record<string, unknown>, defaults: FormulaConfig): FormulaConfig {
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

export function parseStructuredDataConfig(raw: Record<string, unknown>, defaults: StructuredDataConfig): StructuredDataConfig {
  return {
    maxDisplayNameBytes: parseNumber(raw.maxDisplayNameBytes, defaults.maxDisplayNameBytes, "structuredData.maxDisplayNameBytes"),
    maxEntries: parseNumber(raw.maxEntries, defaults.maxEntries, "structuredData.maxEntries"),
    maxFieldsPerCollection: parseNumber(raw.maxFieldsPerCollection, defaults.maxFieldsPerCollection, "structuredData.maxFieldsPerCollection"),
    maxRowsPerCollection: parseNumber(raw.maxRowsPerCollection, defaults.maxRowsPerCollection, "structuredData.maxRowsPerCollection"),
    maxBodyBytes: parseNumber(raw.maxBodyBytes, defaults.maxBodyBytes, "structuredData.maxBodyBytes")
  };
}

export function parseContextConfig(raw: Record<string, unknown>, defaults: ContextManagerConfig): ContextManagerConfig {
  return {
    maxEntriesPerContext: parseNumber(raw.maxEntriesPerContext, defaults.maxEntriesPerContext, "context.maxEntriesPerContext"),
    maxResolveDepth: parseNumber(raw.maxResolveDepth, defaults.maxResolveDepth, "context.maxResolveDepth")
  };
}

export function parseDerivedOutputConfig(raw: Record<string, unknown>, defaults: DerivedOutputConfig): DerivedOutputConfig {
  return {
    maxPlanQueries: parseNumber(raw.maxPlanQueries, defaults.maxPlanQueries, "derivedOutputs.maxPlanQueries"),
    maxToolRounds: parseNumber(raw.maxToolRounds, defaults.maxToolRounds, "derivedOutputs.maxToolRounds")
  };
}

export function parseDocumentConfig(
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

export function parseRetentionConfig(
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

export function parseRichTextLimitsConfig(raw: Record<string, unknown>, defaults: RichTextLimitsConfig): RichTextLimitsConfig {
  return {
    maxAtomsPerContent: parseNumber(raw.maxAtomsPerContent, defaults.maxAtomsPerContent, "richText.maxAtomsPerContent"),
    maxMarksPerContent: parseNumber(raw.maxMarksPerContent, defaults.maxMarksPerContent, "richText.maxMarksPerContent"),
    maxMarkRangeSpan: parseNumber(raw.maxMarkRangeSpan, defaults.maxMarkRangeSpan, "richText.maxMarkRangeSpan")
  };
}
