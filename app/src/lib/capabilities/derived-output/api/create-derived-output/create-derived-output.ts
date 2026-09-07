import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";

import type { CreateDerivedOutputInput, CreateDerivedOutputResult } from "$capabilities/derived-output/types/create-derived-output";
import { validateCreateDerivedOutput } from "$capabilities/derived-output/api/create-derived-output/validate-create-derived-output";
import { outputOf } from "$capabilities/derived-output/api/shared/rows";

/**
 * create-derived-output.
 *
 * The gate first: who is asking and about which project, before anything has
 * happened. Then the input, because a type is a claim about what a caller said
 * it sent and this is the check.
 */
export const createDerivedOutput = async (input: unknown): Promise<CreateDerivedOutputResult> => {
  const scope = await requireScope();

  const createDerivedOutputInput = validateCreateDerivedOutput(input);
  const model = serverModel();
  const projectId = scope.projectId as Id<"projects">;
  const now = Date.now();
  const id = model.store.create("derivedOutputs", {
    projectId,
    prompt: createDerivedOutputInput.prompt,
    definitionRevision: 1,
    ...(createDerivedOutputInput.origin === undefined
      ? {}
      : { origin: createDerivedOutputInput.origin }),
    ...(createDerivedOutputInput.scope === undefined
      ? {}
      : { scope: createDerivedOutputInput.scope }),
    queries: [],
    evidence: [],
    state: "idle",
    createdBy: { kind: "user", userId: scope.userId as Id<"users"> },
    updatedAt: now
  });
  const created = outputOf(model.store, projectId, id);
  if (created === undefined) throw new Error("derived output was not readable after creation");
  return created;
};
