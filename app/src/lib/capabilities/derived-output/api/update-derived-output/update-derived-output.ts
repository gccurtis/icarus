import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";

import type { UpdateDerivedOutputResult } from "$capabilities/derived-output/types/update-derived-output";
import { validateUpdateDerivedOutput } from "$capabilities/derived-output/api/update-derived-output/validate-update-derived-output";
import {
  outputOf,
  writeOutput
} from "$capabilities/derived-output/api/shared/rows";

/**
 * update-derived-output.
 *
 * The gate first: who is asking and about which project, before anything has
 * happened. Then the input, because a type is a claim about what a caller said
 * it sent and this is the check.
 */
export const updateDerivedOutput = async (input: unknown): Promise<UpdateDerivedOutputResult> => {
  const scope = await requireScope();

  const asked = validateUpdateDerivedOutput(input);
  const model = serverModel();
  const projectId = scope.projectId as Id<"projects">;
  const output = outputOf(model.store, projectId, asked.derivedOutputId);
  if (output === undefined) return null;
  if (output.state === "generating") {
    throw new Error("A generating derived output cannot be edited");
  }

  const sameDefinition =
    output.prompt === asked.prompt &&
    JSON.stringify(output.scope) === JSON.stringify(asked.scope);
  if (sameDefinition) return output;

  return writeOutput(model.store, output, {
    prompt: asked.prompt,
    scope: asked.scope,
    state: output.lastResponse === undefined ? "idle" : "stale",
    error: undefined,
    updatedAt: Date.now()
  });
};
