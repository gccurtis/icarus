import type { ReadVariablesInput } from "$capabilities/variables/types/variables";

export const validateReadVariables = (input: unknown): ReadVariablesInput => {
  if (input !== undefined && input !== null && typeof input !== "object") {
    throw new Error("variables/read-variables: an object or nothing is required");
  }
  return {} as ReadVariablesInput;
};
