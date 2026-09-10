import type { ReadVariablesInput } from "$capabilities/variables/types/variables";
import { hasExactFields, storedFields } from "$representation/data/behavior/core/stored";

export const validateReadVariables = (input: unknown): ReadVariablesInput => {
  const fields = storedFields(input);
  if (fields === undefined || !hasExactFields(fields, [])) {
    throw new Error("variables/read-variables: exactly one plain empty object is required");
  }
  return {};
};
