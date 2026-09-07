import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { validateDiscardTemplateStage } from "$capabilities/templates/api/discard-template-stage/validate-discard-template-stage";
import { removeStage, stageById } from "$capabilities/templates/api/shared/stages";
import type { DiscardTemplateStageResult } from "$capabilities/templates/types/templates";

export const discardTemplateStage = async (input: unknown): Promise<DiscardTemplateStageResult> => {
  const scope = await requireScope();
  const asked = validateDiscardTemplateStage(input);

  const store = serverModel().store;
  const stage = stageById(store, asked.stageId);
  if (stage === undefined || stage.projectId !== scope.projectId) {
    return {
      accepted: false,
      stageId: asked.stageId,
      reason: "not-found",
      detail: "no stage in this project has that id"
    };
  }

  removeStage(store, stage);
  return {
    accepted: true,
    stageId: stage._id,
    templateId: stage.templateId,
    target: stage.target,
    resourceId: stage.resourceId
  };
};
