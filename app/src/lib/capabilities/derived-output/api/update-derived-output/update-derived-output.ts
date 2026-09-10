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
import { assertReusableScopeReferences } from "$capabilities/derived-output/api/shared/scope-references";

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
  if (asked.scope !== undefined) {
    assertReusableScopeReferences(model.store, projectId, asked.scope);
  }
  const nextScope = asked.scope ?? output.scope;
  const sameDefinition =
    output.prompt === asked.prompt &&
    JSON.stringify(output.scope) === JSON.stringify(nextScope);
  const responseChanged =
    asked.lastResponse !== undefined &&
    (asked.lastResponse === null
      ? output.lastResponse !== undefined
      : output.lastResponse?.type !== "text" || output.lastResponse.display !== asked.lastResponse);
  if (sameDefinition && !responseChanged) return output;

  const at = Date.now();
  const editedRevision = output.valueSource === "none"
    ? 1
    : output.lastRevision + 1;
  const editedResponse =
    asked.lastResponse === undefined || asked.lastResponse === null || !responseChanged
      ? undefined
      : responseBlock(output, editedRevision, asked.lastResponse, at);

  return writeOutput(model.store, output, {
    prompt: asked.prompt,
    definitionRevision: output.definitionRevision + 1,
    scope: nextScope,
    ...(!responseChanged
      ? {}
      : {
          valueSource: asked.lastResponse === null ? "none" : "authored",
          queries: [],
          evidence: [],
          lastResponse: editedResponse,
          lastRevision: asked.lastResponse === null ? undefined : editedRevision,
          lastGeneration: undefined,
          refreshedAt: undefined
        }),
    state: output.lastResponse === undefined && !responseChanged ? "idle" : "stale",
    error: undefined,
    updatedAt: at
  });
};
