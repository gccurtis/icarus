import type { ReadProjectResourceInput } from "$capabilities/project/types/project";
import { projectInput, projectResourceId } from "$capabilities/project/api/shared/input";

export const validateReadProjectResource = (input: unknown): ReadProjectResourceInput => {
  const message = "project/read-project-resource: only one exact current project resource id is accepted";
  const asked = projectInput(input, ["resourceId"], message);
  return { resourceId: projectResourceId(asked.resourceId, message) };
};
