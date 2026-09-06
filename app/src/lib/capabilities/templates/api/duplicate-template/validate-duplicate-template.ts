import {
  fieldsOf,
  only,
  optionalNameOf,
  templateIdOf
} from "$capabilities/templates/api/shared/validation";
import type { DuplicateTemplateInput } from "$capabilities/templates/types/templates";

export const validateDuplicateTemplate = (input: unknown): DuplicateTemplateInput => {
  const fields = fieldsOf(input, "duplicate-template");
  only(fields, ["templateId", "name"], "duplicate-template");
  const name = optionalNameOf(fields.name, "duplicate-template");
  return {
    templateId: templateIdOf(fields.templateId, "duplicate-template"),
    ...(name === undefined ? {} : { name })
  };
};
