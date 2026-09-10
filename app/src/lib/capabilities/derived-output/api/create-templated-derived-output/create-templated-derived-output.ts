import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import { outputOf } from "$capabilities/derived-output/api/shared/rows";
import { validateCreateTemplatedDerivedOutput } from "$capabilities/derived-output/api/create-templated-derived-output/validate-create-templated-derived-output";
import { assertReusableScopeReferences } from "$capabilities/derived-output/api/shared/scope-references";
import type { CreateTemplatedDerivedOutputResult } from "$capabilities/derived-output/types/create-templated-derived-output";

/** Creates a named-variable definition whose final text is rendered by the application. */
export const createTemplatedDerivedOutput = async (
  input: unknown
): Promise<CreateTemplatedDerivedOutputResult> => {
  const scope = await requireScope();
  const asked = validateCreateTemplatedDerivedOutput(input);
  const model = serverModel();
  const projectId = scope.projectId as Id<"projects">;
  assertReusableScopeReferences(model.store, projectId, asked.scope);
  const at = Date.now();
  const id = model.store.create("derivedOutputs", {
    projectId,
    prompt: asked.template.output,
    definitionRevision: 1,
    template: asked.template,
    ...(asked.origin === undefined ? {} : { origin: asked.origin }),
    ...(asked.scope === undefined ? {} : { scope: asked.scope }),
    queries: [],
    evidence: [],
    state: "idle",
    createdBy: { kind: "user", userId: scope.userId as Id<"users"> },
    updatedAt: at
  });
  const created = outputOf(model.store, projectId, id);
  if (created === undefined) throw new Error("templated derived output was not readable after creation");
  return created;
};
