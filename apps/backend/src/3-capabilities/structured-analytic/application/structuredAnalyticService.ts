// The capability's one entry point: a total command switch and a total query
// switch, plus the two retention hooks.
//
// `pull` is the whole capability in one method — resolve, heal, compile,
// evaluate, shape, receipt — and every other operation is small. Read that one
// first; the rest are bookkeeping around it.

import { toWire, type FormulaEngine, type FormulaWireValue } from "#formula";
import type { Logger } from "#platform/observability/logger.js";
import { compileDefinition, compileToSource } from "../domain/compile.js";
import {
  AnalyticNotFoundError,
  AnalyticPullError,
  StaleAnalyticRevisionError
} from "../domain/errors.js";
import {
  inputKey,
  placementName,
  type AnalyticCheck,
  type AnalyticCheckSource,
  type AnalyticCommand,
  type AnalyticCommandResult,
  type AnalyticDefinition,
  type AnalyticFieldPlacement,
  type AnalyticInput,
  type AnalyticPull,
  type AnalyticQuery,
  type AnalyticQueryResult,
  type AnalyticResultField,
  type AnalyticResultKind,
  type AnalyticScalar,
  type AnalyticShelf,
  type AnalyticSourceRead,
  type AnalyticSourceStatus,
  type StructuredAnalytic,
  type StructuredAnalyticLimits
} from "../domain/model.js";
import {
  validateAnalyticDefinition,
  validateAnalyticDescription,
  validateAnalyticTitle
} from "../domain/validation.js";
import type { ProjectData, ProjectEntryMetadata } from "../ports/projectData.js";
import type { StructuredAnalyticStore } from "../ports/structuredAnalyticStore.js";
import type { StructuredDataWriter } from "../ports/structuredDataWriter.js";

export interface StructuredAnalyticServiceDependencies {
  readonly store: StructuredAnalyticStore;
  readonly projectData: ProjectData;
  readonly writer: StructuredDataWriter;
  readonly formula: FormulaEngine;
  readonly limits: StructuredAnalyticLimits;
  readonly logger: Logger;
  readonly now: () => string;
  readonly newId: () => string;
  /** Attribution for created and updated records. */
  readonly userId: string;
}

export interface StructuredAnalyticService {
  command(command: AnalyticCommand): Promise<AnalyticCommandResult>;
  query(query: AnalyticQuery): Promise<AnalyticQueryResult>;
  pruneHistory(cutoff: string): number;
  purgeExpired(cutoff: string): number;
}

/** Rows placements first, then Columns — the order a pull reports its fields. */
const orderedPlacements = (
  definition: AnalyticDefinition
): ReadonlyArray<{ placement: AnalyticFieldPlacement; shelf: AnalyticShelf }> => [
  ...definition.rows.map(placement => ({ placement, shelf: "row" as const })),
  ...definition.columns.map(placement => ({ placement, shelf: "column" as const }))
];

/**
 * A result column's kind, from the values actually in it.
 *
 * `mixed` rather than a guess when a column disagrees with itself, and
 * `unknown` when it is entirely null — a column of nulls says nothing about
 * what belongs in it, and a client rendering an axis needs to know which of
 * those two it has.
 */
const columnKind = (
  rows: readonly (readonly AnalyticScalar[])[],
  index: number
): AnalyticResultKind => {
  let seen: AnalyticResultKind | undefined;
  for (const row of rows) {
    const cell = row[index];
    if (cell === undefined || cell.kind === "null") continue;
    if (seen === undefined) seen = cell.kind;
    else if (seen !== cell.kind) return "mixed";
  }
  return seen ?? "unknown";
};

const isScalarWire = (value: FormulaWireValue): value is AnalyticScalar =>
  value.kind === "null"
  || value.kind === "number"
  || value.kind === "text"
  || value.kind === "logic";

export const createStructuredAnalyticService = (
  deps: StructuredAnalyticServiceDependencies
): StructuredAnalyticService => {
  const { store, projectData, writer, formula, limits, logger, now, newId, userId } = deps;

  const mustGet = (id: string): StructuredAnalytic => {
    const analytic = store.get(id);
    if (!analytic) {
      logger.warn("structured-analytic.not-found", { analyticId: id }, { detail: "content" });
      throw new AnalyticNotFoundError(id);
    }
    return analytic;
  };

  /**
   * `entryId` is server-captured bookkeeping, never a caller's to set.
   *
   * Honouring a supplied value would let a caller attach an arbitrary id to a
   * name that does not currently resolve, and the first pull would resolve the
   * input to an entry the name never referred to — then heal the stored name to
   * match. A caller-directed retarget through a field documented as a hint.
   */
  const captureEntryIds = async (
    definition: AnalyticDefinition
  ): Promise<AnalyticDefinition> => {
    const inputs: AnalyticInput[] = [];
    for (const input of definition.inputs) {
      const metadata = await projectData.metadata(input.name);
      const captured: AnalyticInput = {
        name: input.name,
        ...(input.as !== undefined ? { as: input.as } : {}),
        // Best effort: a name that does not resolve today is still a legal
        // definition, it simply has no repair hint to record.
        ...(metadata !== undefined ? { entryId: metadata.entryId } : {})
      };
      if (input.entryId !== undefined && input.entryId !== captured.entryId) {
        logger.warn(
          "structured-analytic.entry-id.overwritten",
          { name: input.name, supplied: input.entryId, captured: captured.entryId ?? null },
          { detail: "content" }
        );
      }
      inputs.push(captured);
    }
    return { ...definition, inputs };
  };

  interface ResolvedInput {
    readonly key: string;
    /** Post-heal. `name` here is already the current one. */
    readonly input: AnalyticInput;
    /**
     * The name as stored before this pull, kept because `input.name` is the
     * healed one — without it a rename record cannot say what the name *was*,
     * which is the only reason the record exists.
     *
     * Not the same as `key`: after a first rename the key is pinned as `as` and
     * stops tracking the name, so a second rename would report the original
     * name rather than the one actually being replaced.
     */
    readonly previousName: string;
    readonly metadata: ProjectEntryMetadata;
    readonly status: AnalyticSourceStatus;
  }

  /**
   * Which entry each input means right now.
   *
   * Name first, recorded `entryId` second. That order is the whole rename
   * story: a name that still resolves wins even if the id moved, because the
   * name is the selector and the id is only a hint.
   */
  const resolveInputs = async (
    analytic: StructuredAnalytic
  ): Promise<ResolvedInput[]> => {
    const resolved: ResolvedInput[] = [];
    for (const input of analytic.definition.inputs) {
      const key = inputKey(input);
      const byName = await projectData.metadata(input.name);

      if (byName) {
        // The name resolves. If it now names a *different* entry than the one
        // recorded, the caller is looking at data they did not save against —
        // reported, not refused, because the name is what was selected.
        const status: AnalyticSourceStatus =
          input.entryId !== undefined && input.entryId !== byName.entryId
            ? "retargeted"
            : "ok";
        resolved.push({ key, input, previousName: input.name, metadata: byName, status });
        continue;
      }

      const byId = input.entryId === undefined
        ? undefined
        : await projectData.metadataById(input.entryId);

      if (byId) {
        // Renamed: the entry survives under a new name. The definition heals to
        // match, which is the one write a pull is allowed to make.
        //
        // The key must not move with the name. An input's key is `as ?? name`,
        // so healing a name with no `as` would silently rename the handle that
        // every field ref, join side, and ASTABLE coercion points at. Pinning
        // the old key as `as` keeps the definition internally consistent —
        // which is what `as` is for.
        resolved.push({
          key,
          input: { ...input, name: byId.displayName, as: input.as ?? key },
          previousName: input.name,
          metadata: byId,
          status: "renamed"
        });
        continue;
      }

      logger.warn(
        "structured-analytic.pull.input-not-found",
        { analyticId: analytic.id, input: key, name: input.name, entryId: input.entryId ?? null },
        { detail: "content" }
      );
      throw new AnalyticPullError(
        `input '${key}' names nothing in this project: ${input.name}`,
        key,
        "input_not_found"
      );
    }
    return resolved;
  };

  const pull = async (id: string): Promise<AnalyticPull> => {
    const startedAt = performance.now();
    const analytic = mustGet(id);
    const analyticRevision = analytic.revision;

    logger.debug(
      "structured-analytic.pull.started",
      { analyticId: id, analyticRevision, definition: analytic.definition },
      { detail: "content" }
    );

    const resolved = await resolveInputs(analytic);

    // An input that resolves to a broken formula is a different failure from
    // one that does not resolve at all, and the caller can act on the
    // difference: fix the upstream entry, versus fix the analytic.
    for (const source of resolved) {
      if (source.metadata.issue) {
        logger.warn(
          "structured-analytic.pull.input-unresolved",
          { analyticId: id, input: source.key, issue: source.metadata.issue },
          { detail: "content" }
        );
        throw new AnalyticPullError(
          `input '${source.key}' did not resolve: ${source.metadata.issue.message}`,
          source.key,
          "input_unresolved"
        );
      }
    }

    // Healed names go into the definition *before* compilation. Compiling the
    // stored definition first would emit an expression naming an entry that no
    // longer exists, so every renamed source would fail to evaluate — the exact
    // thing the repair exists to prevent.
    const healed: AnalyticDefinition = {
      ...analytic.definition,
      inputs: resolved.map(source => source.input)
    };
    const renamed = resolved.filter(source => source.status === "renamed");
    if (renamed.length > 0) {
      // Revision-conditioned and best-effort: losing to a concurrent authored
      // edit is an ordinary outcome, and the repair reapplies on the next pull.
      const persisted = store.repairInputNames(id, analyticRevision, healed);
      logger.info(
        "structured-analytic.pull.names-healed",
        {
          analyticId: id,
          analyticRevision,
          persisted,
          healed: renamed.map(source => ({
            input: source.key,
            from: source.previousName,
            to: source.metadata.displayName,
            entryId: source.metadata.entryId
          }))
        },
        { detail: "content" }
      );
    }

    const expression = compileDefinition(healed, formula, logger);
    const snapshot = await projectData.snapshot();
    const evaluated = formula.evaluate({ expression, resolver: snapshot });

    if (!evaluated.ok || evaluated.value === undefined) {
      const diagnostics = evaluated.diagnostics ?? [];
      const limitExceeded = diagnostics.some(d => d.code === "limit_exceeded");
      logger.warn(
        "structured-analytic.pull.evaluation-failed",
        { analyticId: id, source: expression.source, diagnostics },
        { detail: "content" }
      );
      throw new AnalyticPullError(
        `analytic did not evaluate: ${diagnostics.map(d => d.message).join("; ")}`,
        undefined,
        limitExceeded ? "limit_exceeded" : "evaluation_failed"
      );
    }

    const wire = toWire(evaluated.value.value);
    if (wire.kind !== "table") {
      // Unreachable while DISPLAY is the outermost call, which the compiler
      // guarantees — so this is a compiler regression, not a data problem.
      logger.error(
        "structured-analytic.pull.not-tabular",
        { analyticId: id, kind: wire.kind, source: expression.source },
        { detail: "content" }
      );
      throw new AnalyticPullError(
        `analytic produced a ${wire.kind}, not a table`,
        undefined,
        "input_not_tabular"
      );
    }

    // ── Shape the result ────────────────────────────────────────────────────
    // The compiled table names its columns by placement name, but orders them
    // keys-then-aggregates. The pull reports Rows-then-Columns, so cells are
    // permuted rather than passed through.
    const ordered = orderedPlacements(healed);
    const columnIndex = new Map(wire.fields.map((name, index) => [name, index]));
    const permutation = ordered.map(({ placement }) => {
      const name = placementName(placement);
      const index = columnIndex.get(name);
      if (index === undefined) {
        logger.error(
          "structured-analytic.pull.column-missing",
          { analyticId: id, expected: name, produced: [...wire.fields], source: expression.source },
          { detail: "content" }
        );
        throw new AnalyticPullError(
          `the compiled result has no column '${name}'`,
          undefined,
          "evaluation_failed"
        );
      }
      return index;
    });

    const rows: AnalyticScalar[][] = wire.rows.map(row =>
      permutation.map(index => {
        const cell = row[index];
        if (!isScalarWire(cell)) {
          throw new AnalyticPullError(
            `a result cell is a ${cell.kind}, which cannot be reported as a value`,
            undefined,
            "evaluation_failed"
          );
        }
        return cell;
      })
    );

    const fields: AnalyticResultField[] = ordered.map(({ placement, shelf }, index) => ({
      placementId: placement.id,
      name: placementName(placement),
      shelf,
      kind: columnKind(rows, index),
      aggregation: placement.aggregation
    }));

    // A chart's data-dependent half. The structural half — how many pills on
    // which shelf — was settled at save; this is the part only data can answer.
    if (healed.display.kind !== "table") {
      const measure = fields.find(field => field.aggregation !== "none");
      if (measure && measure.kind !== "number" && measure.kind !== "unknown") {
        logger.warn(
          "structured-analytic.pull.display-unsatisfied",
          { analyticId: id, display: healed.display.kind, measure },
          { detail: "content" }
        );
        throw new AnalyticPullError(
          `a ${healed.display.kind} needs a numeric measure; '${measure.name}' is ${measure.kind}`,
          undefined,
          "display_unsatisfied"
        );
      }
    }

    // ── The receipt ─────────────────────────────────────────────────────────
    // Built from what the evaluation actually read, not from bookkeeping kept
    // alongside it, so it cannot drift from the calculation it describes.
    const observed = new Map(
      evaluated.value.observedDependencies.map(dependency => [
        dependency.reference.bindingId,
        dependency.reference.ownerRevision
      ])
    );
    const sources: AnalyticSourceRead[] = resolved.map(source => ({
      input: source.key,
      name: source.metadata.displayName,
      entryId: source.metadata.entryId,
      revision: Number(observed.get(source.metadata.entryId) ?? source.metadata.revision),
      status: source.status
    }));

    const result: AnalyticPull = {
      analyticId: id,
      analyticRevision,
      definition: healed,
      display: healed.display,
      fields,
      rows,
      sources,
      pulledAt: now()
    };

    // Everything needed to reproduce this pull, and not the result itself.
    //
    // The rows are the one thing here that is *derivable*: a pull is
    // deterministic given the definition and the source revisions, and both are
    // in this record — so re-running it against those revisions reproduces the
    // rows exactly. Logging them would duplicate the response body into the log
    // for no diagnostic gain, and Formula permits a million cells, so a single
    // pull could write tens of megabytes.
    //
    // Contrast `store.purged`, which logs the history it is about to destroy.
    // That is not derivable from anything, so it stays.
    logger.info(
      "structured-analytic.pull.completed",
      {
        analyticId: id,
        analyticRevision,
        rowCount: rows.length,
        cellCount: rows.length * fields.length,
        fields,
        sources,
        source: expression.source,
        durationMs: Math.round(performance.now() - startedAt)
      },
      { detail: "content" }
    );
    return result;
  };

  const check = async (id: string): Promise<AnalyticCheck> => {
    const analytic = mustGet(id);
    const sources: AnalyticCheckSource[] = [];
    const healedInputs: AnalyticInput[] = [];
    let anyHealed = false;

    // Metadata only: no snapshot, no evaluation, no rows. That is the whole
    // point of `check` — "would a pull still work" without paying for one.
    for (const input of analytic.definition.inputs) {
      const key = inputKey(input);
      const byName = await projectData.metadata(input.name);

      if (byName) {
        const status = input.entryId !== undefined && input.entryId !== byName.entryId
          ? "retargeted"
          : "ok";
        sources.push({
          input: key,
          name: byName.displayName,
          entryId: byName.entryId,
          revision: byName.revision,
          status
        });
        healedInputs.push(input);
        continue;
      }

      const byId = input.entryId === undefined
        ? undefined
        : await projectData.metadataById(input.entryId);

      if (byId) {
        sources.push({
          input: key,
          name: byId.displayName,
          entryId: byId.entryId,
          revision: byId.revision,
          status: "renamed"
        });
        // `as` pinned for the same reason as in a pull: the key is the handle,
        // and healing a name must not move it.
        healedInputs.push({ ...input, name: byId.displayName, as: input.as ?? key });
        anyHealed = true;
        continue;
      }

      sources.push({ input: key, name: input.name, status: "missing" });
      healedInputs.push(input);
    }

    if (anyHealed) {
      store.repairInputNames(id, analytic.revision, {
        ...analytic.definition,
        inputs: healedInputs
      });
    }

    const result: AnalyticCheck = {
      analyticId: id,
      analyticRevision: analytic.revision,
      sources,
      checkedAt: now()
    };
    logger.debug("structured-analytic.check", { check: result }, { detail: "content" });
    return result;
  };

  const command = async (input: AnalyticCommand): Promise<AnalyticCommandResult> => {
    const startedAt = performance.now();
    logger.info(
      "structured-analytic.command.started",
      { type: input.type, input },
      { detail: "content" }
    );

    const finish = <T extends AnalyticCommandResult>(result: T): T => {
      logger.info(
        "structured-analytic.command.completed",
        { type: input.type, result, durationMs: Math.round(performance.now() - startedAt) },
        { detail: "content" }
      );
      return result;
    };

    switch (input.type) {
      case "analytic.create": {
        const title = validateAnalyticTitle(input.input.title, limits);
        const description = validateAnalyticDescription(input.input.description, limits);
        const definition = validateAnalyticDefinition(input.input.definition, limits, logger);
        // Compile before storing: a definition that cannot be lowered would
        // otherwise fail on every pull instead of once, here.
        compileDefinition(definition, formula, logger);

        const at = now();
        const analytic: StructuredAnalytic = {
          id: newId(),
          title,
          ...(description !== undefined ? { description } : {}),
          definition: await captureEntryIds(definition),
          revision: 1,
          createdBy: userId,
          updatedBy: userId,
          createdAt: at,
          updatedAt: at
        };
        store.insert(analytic);
        return finish({ type: "analytic.created", analytic });
      }

      case "analytic.update": {
        const current = mustGet(input.input.id);
        const title = validateAnalyticTitle(input.input.title, limits);
        const description = validateAnalyticDescription(input.input.description, limits);
        const definition = validateAnalyticDefinition(input.input.definition, limits, logger);
        compileDefinition(definition, formula, logger);

        const analytic: StructuredAnalytic = {
          ...current,
          title,
          ...(description !== undefined ? { description } : { description: undefined }),
          definition: await captureEntryIds(definition),
          revision: current.revision + 1,
          updatedBy: userId,
          updatedAt: now()
        };
        // `description: undefined` above would round-trip as an absent key, but
        // spelling it out keeps "cleared" distinct from "unchanged" at the type
        // level rather than by accident of how JSON handles undefined.
        const next = description === undefined
          ? (({ description: _dropped, ...rest }) => rest)(analytic)
          : analytic;

        if (!store.update(next as StructuredAnalytic, input.input.expectedRevision)) {
          const latest = store.get(input.input.id);
          if (!latest) throw new AnalyticNotFoundError(input.input.id);
          throw new StaleAnalyticRevisionError(
            input.input.id,
            input.input.expectedRevision,
            latest.revision
          );
        }
        return finish({ type: "analytic.updated", analytic: next as StructuredAnalytic });
      }

      case "analytic.delete": {
        if (!store.delete(input.input.id, input.input.expectedRevision, now())) {
          const latest = store.get(input.input.id);
          if (!latest) throw new AnalyticNotFoundError(input.input.id);
          throw new StaleAnalyticRevisionError(
            input.input.id,
            input.input.expectedRevision,
            latest.revision
          );
        }
        return finish({ type: "analytic.deleted", analyticId: input.input.id });
      }

      case "analytic.purge": {
        store.purge(input.input.id);
        return finish({ type: "analytic.purged", analyticId: input.input.id });
      }

      case "analytic.save": {
        // No evaluation, so this cannot fail on data: an analytic whose sources
        // are broken today still saves, and starts working when they are fixed.
        const analytic = mustGet(input.input.id);
        const body = compileToSource(analytic.definition);
        const entry = await writer.declareFormula({
          displayName: input.input.name,
          ...(input.input.description !== undefined
            ? { description: input.input.description }
            : {}),
          body
        });
        return finish({
          type: "analytic.saved",
          analyticId: analytic.id,
          entry: { id: entry.entryId, name: entry.displayName, revision: entry.revision }
        });
      }

      case "analytic.copy": {
        // The inverse trade: this one evaluates, so it can fail on data — and
        // what it writes never moves again.
        const resolvedPull = await pull(input.input.id);
        const entry = await writer.declareTable({
          displayName: input.input.name,
          ...(input.input.description !== undefined
            ? { description: input.input.description }
            : {}),
          fields: resolvedPull.fields.map(field => field.name),
          rows: resolvedPull.rows
        });
        return finish({
          type: "analytic.copied",
          analyticId: input.input.id,
          entry: { id: entry.entryId, name: entry.displayName, revision: entry.revision },
          rowCount: resolvedPull.rows.length
        });
      }
    }
  };

  const query = async (input: AnalyticQuery): Promise<AnalyticQueryResult> => {
    logger.debug("structured-analytic.query.started", { query: input }, { detail: "content" });
    switch (input.type) {
      case "analytic.get":
        return { type: "analytic.record", analytic: mustGet(input.id) };
      case "analytic.list": {
        const analytics = store.list();
        logger.debug(
          "structured-analytic.query.listed",
          { count: analytics.length, analytics },
          { detail: "content" }
        );
        return { type: "analytic.records", analytics };
      }
      case "analytic.pull":
        return { type: "analytic.pull", pull: await pull(input.id) };
      case "analytic.check":
        return { type: "analytic.check", check: await check(input.id) };
    }
  };

  return {
    command,
    query,
    pruneHistory: (cutoff: string): number => store.pruneHistory(cutoff),
    purgeExpired: (cutoff: string): number => {
      let purged = 0;
      for (const id of store.expiredDeleted(cutoff)) {
        try {
          store.purge(id);
          purged += 1;
        } catch (error) {
          // One stuck resource must not strand every analytic behind it in the
          // sweep — the scheduler swallows a throw from here, so a failure that
          // escaped would silently stop the whole batch.
          logger.error(
            "structured-analytic.purge-expired.failed",
            { analyticId: id, reason: error instanceof Error ? error.message : String(error) },
            { detail: "content" }
          );
        }
      }
      logger.info("structured-analytic.purge-expired", { cutoff, purged });
      return purged;
    }
  };
};
