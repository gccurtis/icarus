import { NameManagerError } from "$name-manager/errors";
import { canonicalDate } from "$name-manager/api/define/canonical-date";
import { invalidValue, isRecord } from "$name-manager/api/define/value-guards";
import { canonicalName } from "$name-manager/api/shared/canonical-name";
import type { Field, ValueType } from "$name-manager/types/schema";
import type { DataRecord, DataValue } from "$name-manager/types/values";

const withAncestor = (
  input: object,
  path: string,
  ancestors: ReadonlySet<object>
): ReadonlySet<object> => {
  if (ancestors.has(input)) {
    throw new NameManagerError("invalid-value", `${path} contains a value cycle`);
  }
  const nested = new Set(ancestors);
  nested.add(input);
  return nested;
};

/**
 * Admits a record against its declared fields, **exactly**.
 *
 * Neither a missing field nor an unknown one is tolerated. A missing field would
 * store a record that does not match its own declaration; an unknown one would
 * store data no reader knows how to interpret, and quietly dropping it would
 * lose what an author wrote without saying so.
 */
const canonicalRecord = (
  fields: readonly Field[],
  input: unknown,
  path: string,
  ancestors: ReadonlySet<object>
): DataRecord => {
  if (!isRecord(input)) return invalidValue(path, "an object record");
  const nestedAncestors = withAncestor(input, path, ancestors);
  const expected = new Set(fields.map(({ name }) => name));
  const missing = fields.find(({ name }) => !Object.hasOwn(input, name));
  const extra = Object.keys(input).find((name) => !expected.has(name));
  if (missing || extra) {
    const detail = missing ? `missing field '${missing.name}'` : `unknown field '${extra}'`;
    throw new NameManagerError("invalid-schema", `${path} has ${detail}`);
  }
  return Object.fromEntries(
    fields.map((field) => [
      field.name,
      canonicalValue(field.type, input[field.name], `${path}.${field.name}`, nestedAncestors)
    ])
  );
};

/**
 * Admits an authored value against its declared type, descending through nested
 * fields.
 *
 * Formula and function source is stored as authored text — this capability is a
 * catalog, not an evaluator, and parsing here would make it one. A reference is
 * the exception: it names a variable, so it is admitted as a name and fails with
 * `invalid-name` if it could never refer to anything.
 *
 * A `scalar` table type unwraps to its single field's type, which is what makes
 * a scalar declaration and the value it holds line up without a wrapper object.
 */
export const canonicalValue = (
  type: ValueType,
  input: unknown,
  path: string,
  ancestors: ReadonlySet<object>
): DataValue => {
  switch (type.kind) {
    case "number":
      // Finite, so NaN and the infinities are refused: neither survives a JSON
      // round trip, and the column is jsonb.
      if (typeof input !== "number" || !Number.isFinite(input)) {
        return invalidValue(path, "a finite number");
      }
      return input;
    case "text":
      if (typeof input !== "string") return invalidValue(path, "text");
      return input;
    case "logic":
      if (typeof input !== "boolean") return invalidValue(path, "true or false");
      return input;
    case "date":
      return canonicalDate(input, path);
    case "formula":
      if (typeof input !== "string") return invalidValue(path, "Formula source text");
      return input;
    case "function":
      if (typeof input !== "string") {
        return invalidValue(path, "lambda Formula source text");
      }
      return input;
    case "reference":
      return canonicalName(input, path);
    case "scalar":
      return canonicalValue(type.field.type, input, path, ancestors);
    case "list": {
      if (!Array.isArray(input)) return invalidValue(path, "an array");
      const nestedAncestors = withAncestor(input, path, ancestors);
      return input.map((value, index) =>
        canonicalValue(type.field.type, value, `${path}[${index}]`, nestedAncestors)
      );
    }
    case "record":
      return canonicalRecord(type.fields, input, path, ancestors);
    case "table": {
      if (!Array.isArray(input)) return invalidValue(path, "an array of records");
      const nestedAncestors = withAncestor(input, path, ancestors);
      return input.map((record, index) =>
        canonicalRecord(type.fields, record, `${path}[${index}]`, nestedAncestors)
      );
    }
  }
};
