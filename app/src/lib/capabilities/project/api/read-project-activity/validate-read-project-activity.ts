import type { ReadProjectActivityInput } from "$capabilities/project/types/project";

export const validateReadProjectActivity = (input: unknown): ReadProjectActivityInput => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("project/read-project-activity: an object is required");
  }
  const asked = input as Record<string, unknown>;
  if (Object.keys(asked).length !== 1 || typeof asked.activityId !== "string") {
    throw new Error("project/read-project-activity: only activityId is accepted");
  }
  if (asked.activityId.length === 0 || asked.activityId.length > 500) {
    throw new Error("project/read-project-activity: activityId is required and bounded");
  }
  return { activityId: asked.activityId };
};
