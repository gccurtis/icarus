import type { ServerModel } from "$runtime/server/start.server";
import { OperationFlightsShutdownError } from "$model/server/operation-flights/index.server";
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
import { visibleScopeOf } from "$capabilities/derived-output/api/shared/scope-projection";
import { synthesize } from "$capabilities/derived-output/api/shared/synthesis";

type RefreshRequest = ReturnType<typeof validateRefreshDerivedOutput>;

const throwIfServerShutdown = (signal: AbortSignal): void => {
  if (signal.aborted && signal.reason instanceof OperationFlightsShutdownError) {
    throw signal.reason;
  }
};

export const performDerivedOutputRefresh = async (
  model: ServerModel,
  projectId: Id<"projects">,
  asked: RefreshRequest,
  signal: AbortSignal
): Promise<RefreshDerivedOutputResult> => {
  const original = outputOf(model.store, projectId, asked.derivedOutputId);
  if (original === undefined) return null;

  try {
    await prepareSemanticOverlay(model, projectId, visibleScopeOf(model.store, original), signal);
  } catch (error) {
    throwIfServerShutdown(signal);
    signal.throwIfAborted();
    const current = outputOf(model.store, projectId, original._id);
    if (current === undefined) return null;
    if (definitionKeyOf(current) !== definitionKeyOf(original)) {
      return {
        outcome: "superseded",
        output: current,
        attempts: 0,
        toolCalls: 0,
        usage: emptyUsage()
      };
    }
    const failed = updateOutput(model, current, {
      state: "error",
      error: safeFailure(error),
      updatedAt: Date.now()
    });
    model.observability.logger.warn("derivedOutput.refreshFailed", {
      projectId,
      derivedOutputId: original._id,
      attempts: 0,
      reason: "overlay"
    });
    return {
      outcome: "failed",
      output: failed,
      attempts: 0,
      toolCalls: 0,
      usage: emptyUsage()
    };
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
      const visibleScope = visibleScopeOf(model.store, currentDefinition);
      if (attempts > 1) {
        await prepareSemanticOverlay(model, projectId, visibleScope, signal);
      }
      attemptedDefinitionKey = definitionKeyOf(currentDefinition);
      const executionDefinition =
        visibleScope === currentDefinition.scope
          ? currentDefinition
          : { ...currentDefinition, scope: visibleScope };
      const inputWatermark = semanticInputWatermark(model, projectId);
      const attempt = await synthesize({
        output: executionDefinition,
        intelligence: model.intelligence,
        defaultTopK,
        signal,
        query: async (query) => await querySemanticOverlay(query, signal),
        reading: {
          model,
          ...(asked.selection === undefined ? {} : { selection: asked.selection }),
          queryMaterials: async (query) => await querySemanticMaterials(query, signal)
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

      const revision = current.valueSource === "none"
        ? 1
        : current.lastRevision + 1;
      const at = Date.now();
      const published = updateOutput(model, current, {
        valueSource: "generated",
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
    throwIfServerShutdown(signal);
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
