import {
  hasExactFields,
  isStoredJson,
  storedFields
} from "$representation/data/behavior/core/stored";

export type Fields = Record<string, unknown>;

const fail = (subject: string, message: string): never => {
  throw new Error(`agents/${subject}: ${message}`);
};

/** Admit only the exact data shape that can cross the capability boundary. */
export const fieldsOf = (value: unknown, subject: string): Fields => {
  const fields = storedFields(value);
  if (fields === undefined || !isStoredJson(value)) {
    return fail(subject, "an exact current data object is required");
  }
  return fields;
};

export const has = (fields: Fields, field: string): boolean =>
  Object.hasOwn(fields, field);

export const only = (fields: Fields, allowed: readonly string[], subject: string): void => {
  if (hasExactFields(fields, [], allowed)) return;
  const extra = Reflect.ownKeys(fields).filter(
    (field) => typeof field !== "string" || !allowed.includes(field)
  );
  if (extra.length > 0) {
    fail(subject, `unknown ${extra.length === 1 ? "field" : "fields"} ${extra.map(String).join(", ")}`);
  }
  fail(subject, "only exact current data fields are accepted");
};
