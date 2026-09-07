import { fieldsOf, only, resourceIdOf } from "$capabilities/templates/api/shared/validation";
import type { ReadResourceTemplateInput } from "$capabilities/templates/types/templates";

export const validateReadResourceTemplate = (input: unknown): ReadResourceTemplateInput => {
  const fields = fieldsOf(input, "read-resource-template");
  only(fields, ["resourceId"], "read-resource-template");
  return { resourceId: resourceIdOf(fields.resourceId, "read-resource-template") };
};
