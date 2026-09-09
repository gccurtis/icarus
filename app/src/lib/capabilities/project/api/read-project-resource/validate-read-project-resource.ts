import type { ReadProjectResourceInput } from "$capabilities/project/types/project";

export const validateReadProjectResource = (input: unknown): ReadProjectResourceInput => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("project/read-project-resource: an object is required");
  }
  const asked = input as Record<string, unknown>;
  if (Object.keys(asked).length !== 1 || typeof asked.resourceId !== "string") {
    throw new Error("project/read-project-resource: only resourceId is accepted");
  }
  if (asked.resourceId.length === 0 || asked.resourceId.length > 500) {
    throw new Error("project/read-project-resource: resourceId is required and bounded");
  }
  return { resourceId: asked.resourceId };
};
