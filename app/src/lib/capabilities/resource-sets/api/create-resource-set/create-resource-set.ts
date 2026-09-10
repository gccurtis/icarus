import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";

import { validateCreateResourceSet } from "$capabilities/resource-sets/api/create-resource-set/validate-create-resource-set";
import { resourceSetReferenceRefusal } from "$capabilities/resource-sets/api/shared/reference-validation";
import type { CreateResourceSetResult } from "$capabilities/resource-sets/types/resource-sets";

export const createResourceSet = async (input: unknown): Promise<CreateResourceSetResult> => {
  const scope = await requireScope();
  const asked = validateCreateResourceSet(input);

  const store = serverModel().store;
  const referenceRefusal = resourceSetReferenceRefusal(store, scope.projectId, asked.set);
  if (referenceRefusal !== undefined) {
    return {
      accepted: false,
      reason: "invalid-reference",
      detail: referenceRefusal
    };
  }
  const actor = { kind: "user" as const, userId: asId<"users">(scope.userId) };
  const setId = store.create("resourceSets", {
    projectId: asId<"projects">(scope.projectId),
    name: asked.name,
    ...(asked.description === undefined ? {} : { description: asked.description }),
    set: asked.set,
    createdBy: actor,
    revision: 1,
    updatedAt: Date.now()
  });

  return { accepted: true, setId, revision: 1 };
};
