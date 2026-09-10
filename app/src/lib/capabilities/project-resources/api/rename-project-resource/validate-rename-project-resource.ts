import type { RenameProjectResourceInput } from "$capabilities/project-resources/types/project-resources";

const fail = (reason: string): never => {
  throw new Error(`project-resources/rename-project-resource: ${reason}`);
};

export const validateRenameProjectResource = (input: unknown): RenameProjectResourceInput => {
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input) ||
    Object.keys(input).length !== 2 ||
    !Object.hasOwn(input, "resourceId") ||
    !Object.hasOwn(input, "title")
  ) return fail("an exact object is required");
  const { resourceId, title } = input as { resourceId?: unknown; title?: unknown };
  if (
    typeof resourceId !== "string" ||
    resourceId.length === 0 ||
    resourceId !== resourceId.trim() ||
    /[.\s]/.test(resourceId)
  ) return fail("resourceId is required");
  if (typeof title !== "string" || title.trim().length === 0 || title.trim().length > 500) {
    return fail("title must be between 1 and 500 characters");
  }
  return { resourceId, title: title.trim() };
};
