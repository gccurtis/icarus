import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";

import type { UpdateDerivedOutputResult } from "$capabilities/derived-output/types/update-derived-output";
import { validateUpdateDerivedOutput } from "$capabilities/derived-output/api/update-derived-output/validate-update-derived-output";
import {
  outputOf,
  responseBlock,
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
  if (output.template !== undefined) {
    throw new Error("A templated derived output cannot be edited through the prompt update path");
  }
  if (output.state === "generating") {
    throw new Error("A generating derived output cannot be edited");
  }

  const sameDefinition =
    output.prompt === asked.prompt &&
    JSON.stringify(output.scope) === JSON.stringify(asked.scope);
  const responseChanged =
    asked.lastResponse !== undefined &&
    (output.lastResponse?.type !== "text" ||
      output.lastResponse.display !== asked.lastResponse);
  if (sameDefinition && !responseChanged) return output;

  const at = Date.now();
  const editedRevision = (output.lastRevision ?? 0) + 1;
  const editedResponse =
    asked.lastResponse === undefined || !responseChanged
      ? undefined
      : responseBlock(output, editedRevision, asked.lastResponse, at);

  return writeOutput(model.store, output, {
    prompt: asked.prompt,
    scope: asked.scope,
    ...(editedResponse === undefined
      ? {}
      : {
          queries: [],
          evidence: [],
          lastResponse: editedResponse,
          lastRevision: editedRevision,
          lastGeneration: undefined,
          refreshedAt: undefined
        }),
    state: output.lastResponse === undefined && !responseChanged ? "idle" : "stale",
    error: undefined,
    updatedAt: at
  });
};
