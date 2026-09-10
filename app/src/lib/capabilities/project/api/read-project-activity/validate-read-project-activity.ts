import type { ReadProjectActivityInput } from "$capabilities/project/types/project";
import { projectInput, projectRowId } from "$capabilities/project/api/shared/input";

export const validateReadProjectActivity = (input: unknown): ReadProjectActivityInput => {
  const message = "project/read-project-activity: only one exact current activityId is accepted";
  const asked = projectInput(input, ["activityId"], message);
  return { activityId: projectRowId(asked.activityId, "activity", message) };
};
