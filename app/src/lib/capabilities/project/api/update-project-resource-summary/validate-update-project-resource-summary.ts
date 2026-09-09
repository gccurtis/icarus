import type { UpdateProjectResourceSummaryInput } from "$capabilities/project/types/project";

export const validateUpdateProjectResourceSummary = (
  input: unknown
): UpdateProjectResourceSummaryInput => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("project/update-resource-summary: an object is required");
  }
  const asked = input as Record<string, unknown>;
  if (
    Object.keys(asked).length !== 2 ||
    typeof asked.resourceId !== "string" ||
    typeof asked.summary !== "string"
  ) {
    throw new Error("project/update-resource-summary: only resourceId and summary are accepted");
  }
  if (asked.resourceId.length === 0 || asked.resourceId.length > 500) {
    throw new Error("project/update-resource-summary: resourceId is required and bounded");
  }
  const summary = asked.summary.trim();
  if (summary.length > 1_000) {
    throw new Error("project/update-resource-summary: summary is limited to 1000 characters");
  }
  return { resourceId: asked.resourceId, summary };
};
