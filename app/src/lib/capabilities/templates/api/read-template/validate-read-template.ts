import { fieldsOf, only, templateIdOf } from "$capabilities/templates/api/shared/validation";
import type { ReadTemplateInput } from "$capabilities/templates/types/templates";

export const validateReadTemplate = (input: unknown): ReadTemplateInput => {
  const fields = fieldsOf(input, "read-template");
  only(fields, ["templateId"], "read-template");
  return { templateId: templateIdOf(fields.templateId, "read-template") };
};
