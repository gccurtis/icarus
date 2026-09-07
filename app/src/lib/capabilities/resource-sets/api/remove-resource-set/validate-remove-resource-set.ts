import {
  fieldsOf,
  only,
  revisionOf,
  setIdOf
} from "$capabilities/resource-sets/api/shared/validation";
import type { RemoveResourceSetInput } from "$capabilities/resource-sets/types/resource-sets";

export const validateRemoveResourceSet = (input: unknown): RemoveResourceSetInput => {
  const fields = fieldsOf(input, "remove-resource-set");
  only(fields, ["setId", "baseRevision"], "remove-resource-set");
  return {
    setId: setIdOf(fields.setId, "remove-resource-set"),
    baseRevision: revisionOf(fields.baseRevision, "remove-resource-set")
  };
};
