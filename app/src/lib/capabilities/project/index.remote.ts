import { command, query } from "$app/server";

import { readProjectActivity as readProjectActivityProcedure } from "$capabilities/project/api/read-project-activity/read-project-activity";
import { readProjectComment as readProjectCommentProcedure } from "$capabilities/project/api/read-project-comment/read-project-comment";
import { readProjectHistory as readProjectHistoryProcedure } from "$capabilities/project/api/read-project-history/read-project-history";
import { readProjectOverview as readProjectOverviewProcedure } from "$capabilities/project/api/read-project-overview/read-project-overview";
import { readProjectPerson as readProjectPersonProcedure } from "$capabilities/project/api/read-project-person/read-project-person";
import { readProjectResource as readProjectResourceProcedure } from "$capabilities/project/api/read-project-resource/read-project-resource";
import { updateProjectResourceSummary as updateProjectResourceSummaryProcedure } from "$capabilities/project/api/update-project-resource-summary/update-project-resource-summary";

export const readProjectOverview = query(readProjectOverviewProcedure);
export const readProjectHistory = query("unchecked", readProjectHistoryProcedure);
export const readProjectPerson = query("unchecked", readProjectPersonProcedure);
export const readProjectActivity = query("unchecked", readProjectActivityProcedure);
export const readProjectComment = query("unchecked", readProjectCommentProcedure);
export const readProjectResource = query("unchecked", readProjectResourceProcedure);
export const updateProjectResourceSummary = command("unchecked", async (input) => {
  const result = await updateProjectResourceSummaryProcedure(input);
  await readProjectResource({ resourceId: result.resourceId }).refresh();
  return result;
});

export type {
  ProjectActivityEntry,
  ProjectActivityTarget,
  ProjectCommentAnchor,
  ProjectCommentDetail,
  ProjectCommentRemark,
  ProjectPanelActor,
  ProjectPersonDetail,
  ProjectResourceDetail,
  ProjectResourceFact,
  ProjectResourceKind,
  ReadProjectActivityInput,
  ReadProjectActivityResult,
  ReadProjectCommentInput,
  ReadProjectCommentResult,
  ReadProjectHistoryInput,
  ReadProjectHistoryResult,
  ReadProjectOverviewResult,
  ReadProjectPersonInput,
  ReadProjectPersonResult,
  ReadProjectResourceInput,
  ReadProjectResourceResult,
  UpdateProjectResourceSummaryInput,
  UpdateProjectResourceSummaryResult
} from "$capabilities/project/types/project";
