import type { ReadProjectPersonInput } from "$capabilities/project/types/project";

export const validateReadProjectPerson = (input: unknown): ReadProjectPersonInput => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("project/read-project-person: an object is required");
  }
  const asked = input as Record<string, unknown>;
  if (Object.keys(asked).length !== 1 || typeof asked.userId !== "string") {
    throw new Error("project/read-project-person: only userId is accepted");
  }
  if (asked.userId.length === 0 || asked.userId.length > 500) {
    throw new Error("project/read-project-person: userId is required and bounded");
  }
  return { userId: asked.userId };
};
