import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { changedSemanticMaterials, changedSemanticSources } from "$representation/data/behavior/semantic/citation";
import type { Id } from "$representation/data/types/core/id";

import type { ReadDerivedOutputResult } from "$capabilities/derived-output/types/read-derived-output";
import { validateReadDerivedOutput } from "$capabilities/derived-output/api/read-derived-output/validate-read-derived-output";
import {
  activeSources,
  activeMaterials,
  currentGeneration,
  outputOf
} from "$capabilities/derived-output/api/shared/rows";
import { derivedOutputRefreshJobFor } from "$capabilities/derived-output/api/shared/refresh-job-reading";
import { visibleScopeOf } from "$capabilities/derived-output/api/shared/scope-projection";

/**
 * read-derived-output.
 *
 * The gate first: who is asking and about which project, before anything has
 * happened. Then the input, because a type is a claim about what a caller said
 * it sent and this is the check.
 */
export const readDerivedOutput = async (input: unknown): Promise<ReadDerivedOutputResult> => {
  const scope = await requireScope();

  const asked = validateReadDerivedOutput(input);
  const model = serverModel();
  const projectId = scope.projectId as Id<"projects">;
  const output = outputOf(model.store, projectId, asked.derivedOutputId);
  if (output === undefined) return null;
  const visibleScope = visibleScopeOf(model.store, output);
  const visibleOutput =
    visibleScope === output.scope ? output : { ...output, scope: visibleScope };
  const refreshJob = derivedOutputRefreshJobFor(
    model,
    projectId,
    asked.derivedOutputId
  );

  const changedSources = changedSemanticSources(
    output.evidence,
    activeSources(model.store, projectId)
  );
  const changedMaterials = changedSemanticMaterials(
    output.evidence,
    activeMaterials(model.store, projectId)
  );
  const negativeResultChanged =
    output.state === "fresh" &&
    output.evidence.length === 0 &&
    output.lastGeneration !== undefined &&
    output.lastGeneration !== currentGeneration(model.store, projectId);
  return {
    output: visibleOutput,
    effectiveState:
      output.state === "fresh" && (changedSources.length > 0 || changedMaterials.length > 0 || negativeResultChanged)
        ? "stale"
        : output.state,
    refresh: refreshJob === undefined
      ? { state: "idle" }
      : {
          state: refreshJob.state,
          queuedAt: refreshJob.queuedAt,
          ...(refreshJob.startedAt === undefined ? {} : { startedAt: refreshJob.startedAt }),
          ...(refreshJob.error === undefined ? {} : { error: refreshJob.error })
        },
    changedSources,
    changedMaterials
  };
};
