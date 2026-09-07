import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { changedSemanticSources } from "$representation/data/behavior/semantic/citation";
import type { Id } from "$representation/data/types/core/id";

import type { ReadDerivedOutputResult } from "$capabilities/derived-output/types/read-derived-output";
import { validateReadDerivedOutput } from "$capabilities/derived-output/api/read-derived-output/validate-read-derived-output";
import {
  activeSources,
  currentGeneration,
  outputOf
} from "$capabilities/derived-output/api/shared/rows";

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

  const changedSources = changedSemanticSources(
    output.evidence,
    activeSources(model.store, projectId)
  );
  const negativeResultChanged =
    output.state === "fresh" &&
    output.evidence.length === 0 &&
    output.lastGeneration !== undefined &&
    output.lastGeneration !== currentGeneration(model.store, projectId);
  return {
    output,
    effectiveState:
      output.state === "fresh" && (changedSources.length > 0 || negativeResultChanged)
        ? "stale"
        : output.state,
    changedSources
  };
};
