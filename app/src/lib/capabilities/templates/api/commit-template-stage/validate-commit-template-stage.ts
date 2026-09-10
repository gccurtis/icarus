import {
  fieldsOf,
  only,
  revisionOf
} from "$capabilities/templates/api/shared/validation";
import { stageIdOf } from "$capabilities/templates/api/shared/stage-validation";
import type { CommitTemplateStageInput } from "$capabilities/templates/types/templates";

export const validateCommitTemplateStage = (input: unknown): CommitTemplateStageInput => {
  const fields = fieldsOf(input, "commit-template-stage");
  only(fields, ["stageId", "baseRevision"], "commit-template-stage");
  return {
    stageId: stageIdOf(fields.stageId, "commit-template-stage"),
    baseRevision: revisionOf(fields.baseRevision, "commit-template-stage")
  };
};
