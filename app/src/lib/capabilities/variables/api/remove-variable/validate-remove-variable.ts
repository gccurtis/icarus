import type { RemoveVariableInput } from "$capabilities/variables/types/variables";

export const validateRemoveVariable = (input: unknown): RemoveVariableInput => {
  if (typeof input !== "object" || input === null) {
    throw new Error("variables/remove-variable: an object is required");
  }

  const { name } = input as { name?: unknown };
  if (typeof name !== "string" || name.length === 0) {
    throw new Error("variables/remove-variable: name is required");
  }
  return { name };
};
