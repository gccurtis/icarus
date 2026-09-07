import { requireScope } from "$runtime/server/scope.server";
import { serverModel, type ServerModel } from "$runtime/server/start.server";
import { changedSemanticMaterials, changedSemanticSources } from "$representation/data/behavior/semantic/citation";
import type { Id } from "$representation/data/types/core/id";
import type { DerivedOutput } from "$representation/data/types/semantic/derived-output";
import {
  processSemanticSyncQueueFor,
  querySemanticMaterials,
  querySemanticOverlay
} from "$capabilities/semantic-overlay";

import type {
  DerivedSynthesisUsage,
  RefreshDerivedOutputResult
} from "$capabilities/derived-output/types/refresh-derived-output";
import { validateRefreshDerivedOutput } from "$capabilities/derived-output/api/refresh-derived-output/validate-refresh-derived-output";
import {
  activeSources,
  activeMaterials,
  currentGeneration,
  outputOf,
  responseBlock,
  writeOutput
} from "$capabilities/derived-output/api/shared/rows";
import { synthesize } from "$capabilities/derived-output/api/shared/synthesis";
import {
  enqueueDerivedOutputRefreshFor,
  processDerivedOutputRefreshFor
} from "$capabilities/derived-output/api/shared/refresh-queue";

/**
 * refresh-derived-output.
 *
 * The gate first: who is asking and about which project, before anything has
 * happened. Then the input, because a type is a claim about what a caller said
 * it sent and this is the check.
 */
const configuredInteger = (
  model: ServerModel,
  key: string,
  options: { min: number; max: number }
): number => {
  const value = model.configuration.get(key);
  if (!Number.isInteger(value) || (value as number) < options.min || (value as number) > options.max) {
    throw new Error(
      `Configuration key '${key}' must be an integer from ${options.min} through ${options.max}`
    );
  }
  return value as number;
};

const emptyUsage = (): DerivedSynthesisUsage => ({
  providerRequests: 0,
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  embeddings: []
});

const addAttemptUsage = (
  total: DerivedSynthesisUsage,
  attempt: Awaited<ReturnType<typeof synthesize>>
): DerivedSynthesisUsage => ({
  providerRequests: total.providerRequests + attempt.intelligenceUsage.requestCount,
  promptTokens: total.promptTokens + attempt.intelligenceUsage.promptTokens,
  completionTokens: total.completionTokens + attempt.intelligenceUsage.completionTokens,
  totalTokens: total.totalTokens + attempt.intelligenceUsage.totalTokens,
  ...((total.reasoningTokens !== undefined || attempt.intelligenceUsage.reasoningTokens !== undefined)
    ? {
        reasoningTokens:
          (total.reasoningTokens ?? 0) + (attempt.intelligenceUsage.reasoningTokens ?? 0)
      }
    : {}),
  ...((total.costUsd !== undefined || attempt.intelligenceUsage.costUsd !== undefined)
    ? { costUsd: (total.costUsd ?? 0) + (attempt.intelligenceUsage.costUsd ?? 0) }
    : {}),
  embeddings: [...total.embeddings, ...attempt.embeddingUsage]
});

const sameDefinition = (left: DerivedOutput, right: DerivedOutput): boolean =>
  left.updatedAt === right.updatedAt &&
  left.prompt === right.prompt &&
  JSON.stringify(left.template) === JSON.stringify(right.template) &&
  JSON.stringify(left.scope) === JSON.stringify(right.scope) &&
  JSON.stringify(left.origin) === JSON.stringify(right.origin);

const safeFailure = (error: unknown): string =>
  (error instanceof Error ? error.message : "Derived output refresh failed")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(?:api[-_ ]?key)\s*[:=]\s*\S+/gi, "apiKey=[redacted]")
    .slice(0, 400);

const prepareSemanticOverlay = async (
  model: ServerModel,
  projectId: Id<"projects">
): Promise<void> => {
  // Refresh is a pull boundary. Drain bounded batches until the project has no
  // queued exact-text or material work, while refusing an unbounded churn loop.
  for (let batch = 0; batch < 20; batch += 1) {
    const processed = await processSemanticSyncQueueFor(model, projectId, 50);
    const failed = processed.processed.find((job) => job.error !== undefined);
    const failedMaterial = processed.materials.processed.find(
      (job) => job.error !== undefined
    );
    if (failed?.error !== undefined) throw new Error(failed.error);
    if (failedMaterial?.error !== undefined) throw new Error(failedMaterial.error);
    if (processed.remaining === 0 && processed.materials.remaining === 0) return;
  }
  throw new Error("The Semantic Overlay queue did not settle before refresh");
};

type RefreshRequest = ReturnType<typeof validateRefreshDerivedOutput>;

const performDerivedOutputRefresh = async (
  model: ServerModel,
  projectId: Id<"projects">,
  asked: RefreshRequest
): Promise<RefreshDerivedOutputResult> => {
  await prepareSemanticOverlay(model, projectId);

  let original = outputOf(model.store, projectId, asked.derivedOutputId);
  if (original === undefined) return null;
  if (original.state === "generating") {
    // A live worker is joined by processDerivedOutputRefreshFor before this
    // function is entered. A persisted generating row here is therefore an
    // interrupted older worker and is safe for the new durable job to reclaim.
    original = writeOutput(model.store, original, {
      state: original.lastResponse === undefined ? "idle" : "stale",
      error: undefined,
      updatedAt: Date.now()
    });
  }

  if (original.state === "fresh" && asked.selection === undefined) {
    const changedSources = changedSemanticSources(
      original.evidence,
      activeSources(model.store, projectId)
    );
    const changedMaterials = changedSemanticMaterials(
      original.evidence,
      activeMaterials(model.store, projectId)
    );
    const generation = currentGeneration(model.store, projectId);
    const negativeResultChanged =
      original.evidence.length === 0 &&
      original.lastGeneration !== generation;
    if (
      changedSources.length === 0 &&
      changedMaterials.length === 0 &&
      !negativeResultChanged
    ) {
      return {
        outcome: "current",
        output: original,
        attempts: 0,
        toolCalls: 0,
        usage: emptyUsage()
      };
    }
  }

  const maxRetries = configuredInteger(model, "intelligence.agent.maxSourceRetries", {
    min: 0,
    max: 10
  });
  const defaultTopK = configuredInteger(model, "intelligence.agent.defaultTopK", {
    min: 1,
    max: 20
  });
  const locked = writeOutput(model.store, original, {
    state: "generating",
    error: undefined,
    updatedAt: Date.now()
  });
  let usage = emptyUsage();
  let attempts = 0;
  let toolCalls = 0;

  try {
    for (attempts = 1; attempts <= maxRetries + 1; attempts += 1) {
      const attempt = await synthesize({
        output: original,
        intelligence: model.intelligence,
        defaultTopK,
        query: async (query) => await querySemanticOverlay(query),
        reading: {
          model,
          ...(asked.selection === undefined ? {} : { selection: asked.selection }),
          queryMaterials: async (query) => await querySemanticMaterials(query)
        }
      });
      usage = addAttemptUsage(usage, attempt);
      toolCalls += attempt.toolCalls;

      const current = outputOf(model.store, projectId, original._id);
      if (current === undefined) return null;
      if (current.state !== "generating" || !sameDefinition(locked, current)) {
        model.observability.logger.info("derivedOutput.refreshSuperseded", {
          projectId,
          derivedOutputId: original._id,
          attempts
        });
        return { outcome: "superseded", output: current, attempts, toolCalls, usage };
      }

      const changed = changedSemanticSources(
        attempt.evidence,
        activeSources(model.store, projectId)
      );
      const changedMaterials = changedSemanticMaterials(
        attempt.evidence,
        activeMaterials(model.store, projectId)
      );
      const generation = currentGeneration(model.store, projectId);
      const unstableNegativeResult =
        attempt.evidence.length === 0 &&
        (attempt.overlayGenerations.length === 0 ||
          attempt.overlayGenerations.some((observed) => observed !== generation));
      if (changed.length > 0 || changedMaterials.length > 0 || unstableNegativeResult) {
        if (attempts <= maxRetries) continue;
        const failed = writeOutput(model.store, current, {
          state: "error",
          error: unstableNegativeResult
            ? "The Semantic Overlay kept changing while the response was being generated"
            : "Cited sources kept changing while the response was being generated",
          updatedAt: Date.now()
        });
        model.observability.logger.warn("derivedOutput.refreshFailed", {
          projectId,
          derivedOutputId: original._id,
          attempts,
          reason: unstableNegativeResult ? "overlay-churn" : "source-churn"
        });
        return { outcome: "failed", output: failed, attempts, toolCalls, usage };
      }

      const revision = (original.lastRevision ?? 0) + 1;
      const at = Date.now();
      const published = writeOutput(model.store, current, {
        queries: attempt.queries,
        evidence: attempt.evidence,
        lastVariables: attempt.variables,
        lastResponse: responseBlock(original, revision, attempt.text, at),
        lastRevision: revision,
        lastGeneration: generation,
        state: "fresh",
        error: undefined,
        refreshedAt: at,
        updatedAt: at
      });
      model.observability.logger.info("derivedOutput.refreshed", {
        projectId,
        derivedOutputId: original._id,
        revision,
        generation: published.lastGeneration,
        attempts,
        toolCalls,
        evidenceCount: published.evidence.length
      });
      return { outcome: "published", output: published, attempts, toolCalls, usage };
    }
  } catch (error) {
    const current = outputOf(model.store, projectId, original._id);
    if (current === undefined) return null;
    if (current.state !== "generating" || !sameDefinition(locked, current)) {
      model.observability.logger.info("derivedOutput.refreshSuperseded", {
        projectId,
        derivedOutputId: original._id,
        attempts
      });
      return { outcome: "superseded", output: current, attempts, toolCalls, usage };
    }
    const failed = writeOutput(model.store, current, {
      state: "error",
      error: safeFailure(error),
      updatedAt: Date.now()
    });
    model.observability.logger.warn("derivedOutput.refreshFailed", {
      projectId,
      derivedOutputId: original._id,
      attempts,
      reason: "synthesis"
    });
    return { outcome: "failed", output: failed, attempts, toolCalls, usage };
  }

  throw new Error("derived output refresh ended without a result");
};

export const refreshDerivedOutput = async (input: unknown): Promise<RefreshDerivedOutputResult> => {
  const scope = await requireScope();
  const asked = validateRefreshDerivedOutput(input);
  const model = serverModel();
  const projectId = scope.projectId as Id<"projects">;
  if (outputOf(model.store, projectId, asked.derivedOutputId) === undefined) return null;

  enqueueDerivedOutputRefreshFor(
    model,
    projectId,
    asked.derivedOutputId,
    asked.selection
  );
  return processDerivedOutputRefreshFor(
    model,
    projectId,
    asked.derivedOutputId,
    async (selection) =>
      await performDerivedOutputRefresh(model, projectId, {
        derivedOutputId: asked.derivedOutputId,
        ...(selection === undefined ? {} : { selection })
      })
  );
};
