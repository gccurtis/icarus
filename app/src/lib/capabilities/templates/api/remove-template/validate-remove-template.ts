import {
  fieldsOf,
  only,
  revisionOf,
  templateIdOf
} from "$capabilities/templates/api/shared/validation";
import type { RemoveTemplateInput } from "$capabilities/templates/types/templates";

export const validateRemoveTemplate = (input: unknown): RemoveTemplateInput => {
  const fields = fieldsOf(input, "remove-template");
  only(fields, ["templateId", "baseRevision"], "remove-template");
  return {
    templateId: templateIdOf(fields.templateId, "remove-template"),
    baseRevision: revisionOf(fields.baseRevision, "remove-template")
  };
};
