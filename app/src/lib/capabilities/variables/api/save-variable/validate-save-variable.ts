import type { SaveVariableInput } from "$capabilities/variables/types/variables";
import { currentFormulaValue } from "$representation/data/behavior/content/admission-values";
import {
  hasExactFields,
  isStoredChoice,
  isStoredJson,
  isStoredText,
  storedFields
} from "$representation/data/behavior/core/stored";
import type { VariableType, VariableValue } from "$representation/data/types/content/variable-value";

const TYPES = [
  "any", "number", "text", "logic", "date", "list", "record", "table", "reference",
  "range", "function"
] as const satisfies readonly VariableType[];

export const validateSaveVariable = (input: unknown): SaveVariableInput => {
  const fields = storedFields(input);
  if (
    fields === undefined ||
    !hasExactFields(fields, ["name", "value", "type"], ["description"])
  ) {
    throw new Error("variables/save-variable: exactly the current command fields are required");
  }
  if (!isStoredText(fields.name, 160) || fields.name.length === 0) {
    throw new Error("variables/save-variable: name is required");
  }
  if (!isStoredJson(fields.value) || !currentFormulaValue(fields.value)) {
    throw new Error("variables/save-variable: value has exactly one current value shape");
  }
  if (!isStoredChoice(fields.type, TYPES)) {
    throw new Error("variables/save-variable: type is one of the declared kinds");
  }
  if (fields.description !== undefined && !isStoredText(fields.description, 10_000)) {
    throw new Error("variables/save-variable: description is text");
  }

  return {
    name: fields.name,
    value: fields.value as VariableValue,
    type: fields.type,
    ...(fields.description === undefined ? {} : { description: fields.description })
  };
};
