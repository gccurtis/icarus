import type { SaveVariableInput } from "$capabilities/variables/types/variables";
import type { VariableType, VariableValue } from "$representation/data/types/content/variable-value";

const TYPES: readonly VariableType[] = [
  "any",
  "number",
  "text",
  "logic",
  "date",
  "list",
  "record",
  "table",
  "reference",
  "range",
  "function"
];

const KINDS: readonly string[] = [
  "empty",
  "number",
  "text",
  "logic",
  "date",
  "list",
  "record",
  "table",
  "reference",
  "range",
  "function"
];

export const validateSaveVariable = (input: unknown): SaveVariableInput => {
  if (typeof input !== "object" || input === null) {
    throw new Error("variables/save-variable: an object is required");
  }

  const { name, value, type, description } = input as {
    name?: unknown;
    value?: unknown;
    type?: unknown;
    description?: unknown;
  };

  if (typeof name !== "string" || name.length === 0) {
    throw new Error("variables/save-variable: name is required");
  }
  if (typeof value !== "object" || value === null) {
    throw new Error("variables/save-variable: value is required");
  }
  const { kind } = value as { kind?: unknown };
  if (typeof kind !== "string" || !KINDS.includes(kind)) {
    throw new Error("variables/save-variable: a value has a kind");
  }
  if (typeof type !== "string" || !TYPES.includes(type as VariableType)) {
    throw new Error("variables/save-variable: type is one of the declared kinds");
  }
  if (description !== undefined && typeof description !== "string") {
    throw new Error("variables/save-variable: description is text");
  }

  return {
    name,
    value: value as VariableValue,
    type: type as VariableType,
    ...(description === undefined ? {} : { description })
  };
};
