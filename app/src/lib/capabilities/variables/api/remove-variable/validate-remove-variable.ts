import type { RemoveVariableInput } from "$capabilities/variables/types/variables";
import {
  hasExactFields,
  isStoredText,
  storedFields
} from "$representation/data/behavior/core/stored";

export const validateRemoveVariable = (input: unknown): RemoveVariableInput => {
  const fields = storedFields(input);
  if (fields === undefined || !hasExactFields(fields, ["name"])) {
    throw new Error("variables/remove-variable: exactly one plain name field is required");
  }
  if (!isStoredText(fields.name, 160) || fields.name.length === 0) {
    throw new Error("variables/remove-variable: name is required");
  }
  return { name: fields.name };
};
