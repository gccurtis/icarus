import { fieldsOf, only, templateIdOf } from "$capabilities/templates/api/shared/validation";
import type { OpenTemplateStageInput } from "$capabilities/templates/types/templates";

export const validateOpenTemplateStage = (input: unknown): OpenTemplateStageInput => {
  const fields = fieldsOf(input, "open-template-stage");
  only(fields, ["templateId"], "open-template-stage");
  return { templateId: templateIdOf(fields.templateId, "open-template-stage") };
};
