import {
  hasExactFields,
  isStoredJson,
  storedFields
} from "$representation/data/behavior/core/stored";

/** One capability command object with no compatibility projection beside it. */
export const semanticCommand = (
  value: unknown,
  allowed: readonly string[],
  subject: string
): Record<string, unknown> => {
  const input = storedFields(value);
  if (input === undefined || !isStoredJson(value) || !hasExactFields(input, [], allowed)) {
    throw new Error(`${subject} must contain only exact current data fields`);
  }
  return input;
};
