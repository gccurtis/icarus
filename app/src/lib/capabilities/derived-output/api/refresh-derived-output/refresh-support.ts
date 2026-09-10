import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import type { DerivedOutput } from "$representation/data/types/semantic/derived-output";
import { processSemanticSyncQueueFor } from "$capabilities/semantic-overlay";
import type { DerivedSynthesisUsage } from "$capabilities/derived-output/types/refresh-derived-output";
import {
  activeMaterials,
  activeSources,
  currentGeneration,
  rowsOf,
  writeOutput
} from "$capabilities/derived-output/api/shared/rows";
import type { SynthesisAttempt } from "$capabilities/derived-output/api/shared/synthesis";

export const configuredInteger = (
  model: ServerModel,
  key: string,
  options: { min: number; max: number }
): number => {
  const value = model.configuration.get(key);
  if (
    !Number.isInteger(value) ||
    (value as number) < options.min ||
    (value as number) > options.max
  ) {
    throw new Error(
      `Configuration key '${key}' must be an integer from ${options.min} through ${options.max}`
    );
  }
  return value as number;
};

export const emptyUsage = (): DerivedSynthesisUsage => ({
  providerRequests: 0,
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  embeddings: []
});

export const addAttemptUsage = (
  total: DerivedSynthesisUsage,
  attempt: SynthesisAttempt
): DerivedSynthesisUsage => ({
  providerRequests: total.providerRequests + attempt.intelligenceUsage.requestCount,
  promptTokens: total.promptTokens + attempt.intelligenceUsage.promptTokens,
  completionTokens: total.completionTokens + attempt.intelligenceUsage.completionTokens,
  totalTokens: total.totalTokens + attempt.intelligenceUsage.totalTokens,
  ...(total.reasoningTokens !== undefined ||
  attempt.intelligenceUsage.reasoningTokens !== undefined
    ? {
        reasoningTokens:
          (total.reasoningTokens ?? 0) + (attempt.intelligenceUsage.reasoningTokens ?? 0)
      }
    : {}),
  ...(total.costUsd !== undefined || attempt.intelligenceUsage.costUsd !== undefined
    ? { costUsd: (total.costUsd ?? 0) + (attempt.intelligenceUsage.costUsd ?? 0) }
    : {}),
  embeddings: [...total.embeddings, ...attempt.embeddingUsage]
});

export const definitionKeyOf = (output: DerivedOutput): string =>
  JSON.stringify({
    definitionRevision: output.definitionRevision,
    prompt: output.prompt,
    template: output.template ?? null,
    scope: output.scope ?? null,
    origin: output.origin ?? null
  });

export const updateOutput = (
  model: ServerModel,
  output: Parameters<typeof writeOutput>[1],
  patch: Parameters<typeof writeOutput>[2]
) => model.store.transaction((unit) => writeOutput(unit, output, patch));

export const safeFailure = (error: unknown): string =>
  (error instanceof Error ? error.message : "Derived output refresh failed")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(?:api[-_ ]?key)\s*[:=]\s*\S+/gi, "apiKey=[redacted]")
    .slice(0, 400);

export const prepareSemanticOverlay = async (
  model: ServerModel,
  projectId: Id<"projects">
): Promise<void> => {
  for (let batch = 0; batch < 20; batch += 1) {
    const processed = await processSemanticSyncQueueFor(model, projectId, 50);
    const failed = processed.failed[0];
    const failedMaterial = processed.materials.failed[0];
    if (failed?.error !== undefined) throw new Error(failed.error);
    if (failedMaterial?.error !== undefined) throw new Error(failedMaterial.error);
    if (processed.remaining === 0 && processed.materials.remaining === 0) return;
  }
  throw new Error("The Semantic Overlay queue did not settle before refresh");
};

export const semanticInputWatermark = (
  model: ServerModel,
  projectId: Id<"projects">
): string => {
  const byKey = <T extends { key: string }>(left: T, right: T): number =>
    left.key.localeCompare(right.key);
  const sources = activeSources(model.store, projectId)
    .map((source) => ({
      key: `${source.ref.kind}\u0000${source.ref.id}`,
      revision: source.revision,
      contentHash: source.contentHash ?? null
    }))
    .sort(byKey);
  const materials = activeMaterials(model.store, projectId)
    .map((material) => ({
      key: material.materialId,
      revisionKey: material.revisionKey,
      profileHash: material.profileHash,
      contextHash: material.contextHash
    }))
    .sort(byKey);
  const pendingText = rowsOf(model.store, "semanticSyncJobs")
    .filter((job) => job.projectId === projectId && job.state !== "failed")
    .map((job) => ({
      key: `${job.ref.kind}\u0000${job.ref.id}`,
      revision: job.requestedRevision
    }))
    .sort(byKey);
  const pendingMaterials = rowsOf(model.store, "semanticMaterialJobs")
    .filter((job) => job.projectId === projectId && job.state !== "failed")
    .map((job) => ({
      key: `${job.ref.kind}\u0000${job.ref.id}`,
      revision: job.requestedRevision
    }))
    .sort(byKey);
  return JSON.stringify({
    generation: currentGeneration(model.store, projectId),
    sources,
    materials,
    pendingText,
    pendingMaterials
  });
};
