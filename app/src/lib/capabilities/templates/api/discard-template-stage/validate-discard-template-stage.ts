import { fieldsOf, only } from "$capabilities/templates/api/shared/validation";
import { stageIdOf } from "$capabilities/templates/api/shared/stage-validation";
import type { DiscardTemplateStageInput } from "$capabilities/templates/types/templates";

export const validateDiscardTemplateStage = (input: unknown): DiscardTemplateStageInput => {
  const fields = fieldsOf(input, "discard-template-stage");
  only(fields, ["stageId"], "discard-template-stage");
  return { stageId: stageIdOf(fields.stageId, "discard-template-stage") };
};
