import {
  descriptionOf,
  fieldsOf,
  has,
  nameOf,
  only,
  resourceSetOf,
  revisionOf,
  setIdOf
} from "$capabilities/resource-sets/api/shared/validation";
import type {
  UpdateResourceSetInput,
  UpdateResourceSetPatch
} from "$capabilities/resource-sets/types/resource-sets";

export const validateUpdateResourceSet = (input: unknown): UpdateResourceSetInput => {
  const fields = fieldsOf(input, "update-resource-set");
  only(fields, ["setId", "baseRevision", "patch"], "update-resource-set");
  const incoming = fieldsOf(fields.patch, "update-resource-set");
  only(incoming, ["name", "description", "set"], "update-resource-set");
  if (Object.keys(incoming).length === 0) {
    throw new Error("resource-sets/update-resource-set: patch changes at least one field");
  }
  const patch: UpdateResourceSetPatch = {
    ...(has(incoming, "name") ? { name: nameOf(incoming.name, "update-resource-set") } : {}),
    ...(has(incoming, "description")
      ? {
          description:
            incoming.description === null
              ? null
              : descriptionOf(incoming.description, "update-resource-set")
        }
      : {}),
    ...(has(incoming, "set") ? { set: resourceSetOf(incoming.set, "update-resource-set") } : {})
  };
  return {
    setId: setIdOf(fields.setId, "update-resource-set"),
    baseRevision: revisionOf(fields.baseRevision, "update-resource-set"),
    patch
  };
};
