// Wiring Structured Analytic to the rest of the project.
//
// Both adapters are thin on purpose. The read side is a lookup and a snapshot —
// value fetching and normalization belong to the evaluator now, not here. The
// write side is one `declare` call each, plus the one error translation that
// matters: a taken display name is a 409 the caller can act on, not a 500.

import { randomUUID } from "node:crypto";
import type { FormulaEngine, FormulaResolverSnapshot } from "#formula";
import type { Logger } from "#platform/observability/logger.js";
import type { FormulaNameResolver } from "./formula-name-resolver.js";
import type { StructuredData } from "#structured-data";
import { DataEntryConflictError } from "#structured-data";
import {
  AnalyticNameConflictError,
  SQLiteStructuredAnalyticStore,
  createStructuredAnalyticService,
  validateAnalyticLimits,
  type AnalyticScalar,
  type ProjectData,
  type ProjectEntryMetadata,
  type StructuredAnalyticService,
  type StructuredDataWriter
} from "#structured-analytic";
import type { DeclaredEntry } from "#structured-analytic/ports/structuredDataWriter.js";
import type { DataEntry, DataRow, FieldDef, ValueKind } from "#structured-data";
import type { BackendConfig } from "#utils/config/loadBackendConfig.js";

const STRUCTURED_ANALYTIC_DB_PATH = "./data/structured-analytics.db";

/**
 * A resolution failure, phrased for someone reading a 422.
 *
 * The distinction worth preserving is "this name is not in the project" versus
 * "it is, but the formula behind it is broken" — one is the caller's mistake
 * and the other is upstream, and a single "could not resolve" hides which.
 */
const issueFor = (
  resolver: FormulaNameResolver,
  entryId: string
): ProjectEntryMetadata["issue"] => {
  const issue = resolver.getIssue(entryId);
  if (!issue) return undefined;
  return {
    code: issue.code,
    message:
      issue.diagnostics.length > 0
        ? issue.diagnostics.map(diagnostic => diagnostic.message).join("; ")
        : `entry '${issue.displayName}' failed to resolve (${issue.code})`
  };
};

const toMetadata = (
  resolver: FormulaNameResolver,
  entry: DataEntry
): ProjectEntryMetadata => {
  const issue = issueFor(resolver, entry.id);
  return {
    entryId: entry.id,
    displayName: entry.displayName,
    revision: entry.revision,
    ...(issue !== undefined ? { issue } : {})
  };
};

export const createProjectData = (
  structuredData: StructuredData,
  resolver: FormulaNameResolver,
  logger: Logger
): ProjectData => ({
  async snapshot(): Promise<FormulaResolverSnapshot> {
    const startedAt = performance.now();
    const snapshot = await resolver.buildSnapshot();
    logger.debug(
      "structured-analytic.project-data.snapshot",
      {
        snapshotId: snapshot.id,
        bindingCount: snapshot.bindings.size,
        // The names available to resolve against. When a pull fails on "no such
        // input", this is the line that says what *was* there.
        displayNames: [...snapshot.bindings.values()].map(binding => binding.displayName),
        durationMs: Math.round(performance.now() - startedAt)
      },
      { detail: "content" }
    );
    return snapshot;
  },

  async metadata(displayName: string): Promise<ProjectEntryMetadata | undefined> {
    const entry = await structuredData.getByName(displayName);
    const found = entry === undefined ? undefined : toMetadata(resolver, entry);
    logger.debug(
      "structured-analytic.project-data.metadata",
      { displayName, found: found ?? null },
      { detail: "content" }
    );
    return found;
  },

  async metadataById(entryId: string): Promise<ProjectEntryMetadata | undefined> {
    const entry = await structuredData.get(entryId);
    const found = entry === undefined ? undefined : toMetadata(resolver, entry);
    logger.debug(
      "structured-analytic.project-data.metadata-by-id",
      { entryId, found: found ?? null },
      { detail: "content" }
    );
    return found;
  }
});

/**
 * The declared kind of a result column, from the values actually in it.
 *
 * Nulls are skipped rather than typed: a column of nulls says nothing about
 * what belongs in it, and a mixed column is `unknown` rather than a guess —
 * Structured Data has that escape hatch precisely for values it cannot type
 * statically, and a wrong declared kind is worse than an honest `unknown`.
 */
const columnKind = (
  rows: readonly (readonly AnalyticScalar[])[],
  index: number
): ValueKind => {
  let seen: ValueKind | undefined;
  for (const row of rows) {
    const cell = row[index];
    if (cell === undefined || cell.kind === "null") continue;
    if (seen === undefined) seen = cell.kind;
    else if (seen !== cell.kind) return "unknown";
  }
  return seen ?? "unknown";
};

const cellLiteral = (scalar: AnalyticScalar): string | number | boolean | null => {
  switch (scalar.kind) {
    case "text": return scalar.value;
    case "logic": return scalar.value;
    case "number":
      // A copy is a frozen snapshot for reading, and Structured Data's literal
      // cells are JSON scalars — so an exact rational becomes a number here.
      // Precision beyond a double is lost at this boundary, which is a reason
      // to prefer `save` over `copy` when the numbers matter.
      return Number(scalar.numerator) / Number(scalar.denominator);
    // `null` and anything a future scalar kind adds. Falling through to null
    // rather than throwing: a copy is a snapshot for reading, and one
    // unrepresentable cell should not lose the other ten thousand.
    default:
      return null;
  }
};

export const createStructuredDataWriter = (
  structuredData: StructuredData,
  logger: Logger
): StructuredDataWriter => {
  const declared = (entry: DataEntry): DeclaredEntry => ({
    entryId: entry.id,
    displayName: entry.displayName,
    revision: entry.revision
  });

  return {
    async declareFormula(input): Promise<DeclaredEntry> {
      logger.info(
        "structured-analytic.writer.declare-formula",
        { displayName: input.displayName, description: input.description ?? null, body: input.body },
        { detail: "content" }
      );
      try {
        const entry = await structuredData.declare({
          kind: "variable",
          displayName: input.displayName,
          body: input.body,
          ...(input.description !== undefined ? { description: input.description } : {})
        });
        logger.info(
          "structured-analytic.writer.declared-formula",
          { entry: declared(entry) },
          { detail: "content" }
        );
        return declared(entry);
      } catch (error) {
        if (error instanceof DataEntryConflictError) {
          logger.warn(
            "structured-analytic.writer.name-conflict",
            { displayName: input.displayName },
            { detail: "content" }
          );
          throw new AnalyticNameConflictError(input.displayName);
        }
        throw error;
      }
    },

    async declareTable(input): Promise<DeclaredEntry> {
      const schema: FieldDef[] = input.fields.map((name, index) => ({
        name,
        kind: columnKind(input.rows, index)
      }));
      // A DataRow is keyed by field name, not positional — so a compiled table
      // whose columns are `Region` and `Total` becomes rows keyed by those.
      const rows: DataRow[] = input.rows.map(row =>
        Object.fromEntries(
          input.fields.map((name, index) => [
            name,
            row[index] === undefined ? null : cellLiteral(row[index])
          ])
        )
      );

      logger.info(
        "structured-analytic.writer.declare-table",
        {
          displayName: input.displayName,
          description: input.description ?? null,
          schema,
          rowCount: rows.length,
          rows
        },
        { detail: "content" }
      );

      try {
        const entry = await structuredData.declare({
          kind: "table",
          displayName: input.displayName,
          schema,
          rows,
          ...(input.description !== undefined ? { description: input.description } : {})
        });
        logger.info(
          "structured-analytic.writer.declared-table",
          { entry: declared(entry) },
          { detail: "content" }
        );
        return declared(entry);
      } catch (error) {
        if (error instanceof DataEntryConflictError) {
          logger.warn(
            "structured-analytic.writer.name-conflict",
            { displayName: input.displayName },
            { detail: "content" }
          );
          throw new AnalyticNameConflictError(input.displayName);
        }
        throw error;
      }
    }
  };
};

/**
 * Composes the capability. Called once, after Formula and the name resolver
 * exist, because a pull needs both.
 *
 * The limits are validated here rather than at first use: a bad
 * `configuration.yaml` should stop the process at startup, not surface as a
 * confusing rejection on somebody's first request.
 */
export const createStructuredAnalyticInstance = (
  config: BackendConfig,
  structuredData: StructuredData,
  resolver: FormulaNameResolver,
  formula: FormulaEngine,
  logger: Logger
): StructuredAnalyticService => {
  validateAnalyticLimits(config.structuredAnalytic, logger);

  return createStructuredAnalyticService({
    store: new SQLiteStructuredAnalyticStore(
      STRUCTURED_ANALYTIC_DB_PATH,
      config.projectId,
      logger
    ),
    projectData: createProjectData(structuredData, resolver, logger),
    writer: createStructuredDataWriter(structuredData, logger),
    formula,
    limits: config.structuredAnalytic,
    logger,
    now: () => new Date().toISOString(),
    newId: () => randomUUID(),
    userId: config.userId
  });
};
