import type { UpdateProjectResourceSummaryInput } from "$capabilities/project/types/project";
import { projectInput, projectResourceId } from "$capabilities/project/api/shared/input";

export const validateUpdateProjectResourceSummary = (
  input: unknown
): UpdateProjectResourceSummaryInput => {
  const message = "project/update-resource-summary: only exact current resourceId and summary are accepted";
  const asked = projectInput(input, ["resourceId", "summary"], message);
  const resourceId = projectResourceId(asked.resourceId, message);
  if (typeof asked.summary !== "string") throw new Error(message);
  const summary = asked.summary.trim();
  if (summary.length > 1_000) {
    throw new Error("project/update-resource-summary: summary is limited to 1000 characters");
  }
  return { resourceId, summary };
};
