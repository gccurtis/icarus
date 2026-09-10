import type { ServerModel } from "$runtime/server/start.server";
import {
  changedSemanticMaterials,
  changedSemanticSources
} from "$representation/data/behavior/semantic/citation";
import type { Id } from "$representation/data/types/core/id";
import {
  querySemanticMaterials,
  querySemanticOverlay
} from "$capabilities/semantic-overlay";
import type { RefreshDerivedOutputResult } from "$capabilities/derived-output/types/refresh-derived-output";
import { validateRefreshDerivedOutput } from "$capabilities/derived-output/api/refresh-derived-output/validate-refresh-derived-output";
import {
  addAttemptUsage,
  configuredInteger,
  definitionKeyOf,
  emptyUsage,
  prepareSemanticOverlay,
  safeFailure,
  semanticInputWatermark,
  updateOutput
} from "$capabilities/derived-output/api/refresh-derived-output/refresh-support";
import {
  activeMaterials,
  activeSources,
  currentGeneration,
  outputOf,
  responseBlock
} from "$capabilities/derived-output/api/shared/rows";
import { synthesize } from "$capabilities/derived-output/api/shared/synthesis";

type RefreshRequest = ReturnType<typeof validateRefreshDerivedOutput>;

export const performDerivedOutputRefresh = async (
  model: ServerModel,
  projectId: Id<"projects">,
  asked: RefreshRequest,
  signal: AbortSignal
): Promise<RefreshDerivedOutputResult> => {
  await prepareSemanticOverlay(model, projectId);
  const original = outputOf(model.store, projectId, asked.derivedOutputId);
  if (original === undefined) return null;

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
      original.evidence.length === 0 && original.lastGeneration !== generation;
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
  let usage = emptyUsage();
  let attempts = 0;
  let toolCalls = 0;
  const requestedDefinitionKey = definitionKeyOf(original);
  let attemptedDefinitionKey = requestedDefinitionKey;

  try {
    for (attempts = 1; attempts <= maxRetries + 1; attempts += 1) {
      if (attempts > 1) await prepareSemanticOverlay(model, projectId);
      const currentDefinition = outputOf(model.store, projectId, original._id);
      if (currentDefinition === undefined) return null;
      if (definitionKeyOf(currentDefinition) !== requestedDefinitionKey) {
        return {
          outcome: "superseded",
          output: currentDefinition,
          attempts: attempts - 1,
          toolCalls,
          usage
        };
      }
      attemptedDefinitionKey = definitionKeyOf(currentDefinition);
      const inputWatermark = semanticInputWatermark(model, projectId);
      const attempt = await synthesize({
        output: currentDefinition,
        intelligence: model.intelligence,
        defaultTopK,
        signal,
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
      if (definitionKeyOf(current) !== attemptedDefinitionKey) {
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
      const semanticInputsChanged =
        inputWatermark !== semanticInputWatermark(model, projectId);
      const unstableNegativeResult =
        attempt.evidence.length === 0 &&
        (attempt.overlayGenerations.length === 0 ||
          attempt.overlayGenerations.some((observed) => observed !== generation));
      if (
        changed.length > 0 ||
        changedMaterials.length > 0 ||
        unstableNegativeResult ||
        semanticInputsChanged
      ) {
        if (attempts <= maxRetries) continue;
        const overlayChurn = unstableNegativeResult || semanticInputsChanged;
        const failed = updateOutput(model, current, {
          state: "error",
          error: overlayChurn
            ? "The Semantic Overlay kept changing while the response was being generated"
            : "Cited sources kept changing while the response was being generated",
          updatedAt: Date.now()
        });
        model.observability.logger.warn("derivedOutput.refreshFailed", {
          projectId,
          derivedOutputId: original._id,
          attempts,
          reason: overlayChurn ? "overlay-churn" : "source-churn"
        });
        return { outcome: "failed", output: failed, attempts, toolCalls, usage };
      }

      const revision = (current.lastRevision ?? 0) + 1;
      const at = Date.now();
      const published = updateOutput(model, current, {
        queries: attempt.queries,
        evidence: attempt.evidence,
        lastVariables: attempt.variables,
        lastResponse: responseBlock(current, revision, attempt.text, at),
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
    if (definitionKeyOf(current) !== attemptedDefinitionKey) {
      model.observability.logger.info("derivedOutput.refreshSuperseded", {
        projectId,
        derivedOutputId: original._id,
        attempts
      });
      return { outcome: "superseded", output: current, attempts, toolCalls, usage };
    }
    const failed = updateOutput(model, current, {
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
