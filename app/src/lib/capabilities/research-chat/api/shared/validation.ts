import { isStoredRowId } from "$representation/data/behavior/core/stored";
import type { TableName } from "$model/server/store/index.server";

/** Admit exactly the current command object, including non-enumerable and symbolic own keys. */
export const exactCommandInput = (
  input: unknown,
  required: readonly string[],
  optional: readonly string[],
  subject: string
): Record<string, unknown> => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error(`${subject} takes an object`);
  }
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${subject} takes one plain data object`);
  }
  const allowed = [...required, ...optional];
  const keys = Reflect.ownKeys(input);
  const unexpected = keys.find(
    (key) => {
      if (typeof key !== "string" || !allowed.includes(key)) return true;
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      return descriptor === undefined || !("value" in descriptor) ||
        !descriptor.enumerable || descriptor.value === undefined;
    }
  );
  if (unexpected !== undefined) {
    throw new Error(`${subject} has unknown field '${String(unexpected)}' or a non-data value`);
  }
  const missing = required.find((field) => !Object.hasOwn(input, field));
  if (missing !== undefined) {
    throw new Error(`${subject} is missing required field '${missing}'`);
  }
  return input as Record<string, unknown>;
};

/** Admit one nominal id in the current represented table namespace. */
export const currentRowId = (
  value: unknown,
  table: TableName,
  subject: string
): string => {
  if (!isStoredRowId(value, table)) {
    throw new Error(`${subject} needs one current ${table} row id`);
  }
  return value;
};
