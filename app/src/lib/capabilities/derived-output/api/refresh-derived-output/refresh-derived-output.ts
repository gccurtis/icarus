import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { changedSemanticSources } from "$representation/data/behavior/semantic/citation";
import type { TextBlock } from "$representation/data/types/content/content-block";
import type { Id } from "$representation/data/types/core/id";
import type { DerivedOutput } from "$representation/data/types/semantic/derived-output";
import { querySemanticOverlay } from "$capabilities/semantic-overlay/index.remote";

import type {
  DerivedSynthesisUsage,
  RefreshDerivedOutputResult
} from "$capabilities/derived-output/types/refresh-derived-output";
import { validateRefreshDerivedOutput } from "$capabilities/derived-output/api/refresh-derived-output/validate-refresh-derived-output";
import {
  activeSources,
  currentGeneration,
  outputOf,
  writeOutput
} from "$capabilities/derived-output/api/shared/rows";
import { synthesize } from "$capabilities/derived-output/api/shared/synthesis";

/**
 * refresh-derived-output.
 *
 * The gate first: who is asking and about which project, before anything has
 * happened. Then the input, because a type is a claim about what a caller said
 * it sent and this is the check.
 */
const configuredInteger = (
  key: string,
  options: { min: number; max: number }
): number => {
  const value = serverModel().configuration.get(key);
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
  JSON.stringify(left.scope) === JSON.stringify(right.scope);

const safeFailure = (error: unknown): string =>
  (error instanceof Error ? error.message : "Derived output refresh failed")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(?:api[-_ ]?key)\s*[:=]\s*\S+/gi, "apiKey=[redacted]")
    .slice(0, 400);

const responseBlock = (
  output: DerivedOutput,
  revision: number,
  text: string,
  at: number
): TextBlock => ({
  id: `${output._id}:response:${revision}`,
  type: "text",
  variant: "paragraph",
  atoms: [{ id: `${output._id}:response:${revision}:text`, kind: "literal", text }],
  display: text,
  marks: [],
  resolvedAt: at
});

export const refreshDerivedOutput = async (input: unknown): Promise<RefreshDerivedOutputResult> => {
  const scope = await requireScope();

  const asked = validateRefreshDerivedOutput(input);
  const model = serverModel();
  const projectId = scope.projectId as Id<"projects">;
  const original = outputOf(model.store, projectId, asked.derivedOutputId);
  if (original === undefined) return null;
  if (original.state === "generating") {
    throw new Error("This derived output is already generating");
  }

  const maxRetries = configuredInteger("intelligence.agent.maxSourceRetries", {
    min: 0,
    max: 10
  });
  const defaultTopK = configuredInteger("intelligence.agent.defaultTopK", {
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
        query: async (query) => await querySemanticOverlay(query)
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
      if (changed.length > 0) {
        if (attempts <= maxRetries) continue;
        const failed = writeOutput(model.store, current, {
          state: "error",
          error: "Cited sources kept changing while the response was being generated",
          updatedAt: Date.now()
        });
        model.observability.logger.warn("derivedOutput.refreshFailed", {
          projectId,
          derivedOutputId: original._id,
          attempts,
          reason: "source-churn"
        });
        return { outcome: "failed", output: failed, attempts, toolCalls, usage };
      }

      const revision = (original.lastRevision ?? 0) + 1;
      const at = Date.now();
      const published = writeOutput(model.store, current, {
        queries: attempt.queries,
        evidence: attempt.evidence,
        lastResponse: responseBlock(original, revision, attempt.text, at),
        lastRevision: revision,
        lastGeneration: currentGeneration(model.store, projectId),
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
