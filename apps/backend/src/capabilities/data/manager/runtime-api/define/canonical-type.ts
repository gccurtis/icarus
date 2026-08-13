import { DataManagerError } from "#data-manager/errors.js";
import { isRecord } from "#data-manager/runtime-api/define/value-guards.js";
import {
  canonicalName,
  nameKey
} from "#data-manager/runtime-api/shared/canonical-name.js";
import type {
  Field,
  ScalarType,
  ValueType
} from "#data-manager/types/schema.js";

const SCALAR_KINDS = new Set([
  "number",
  "text",
  "logic",
  "date",
  "formula",
  "function",
  "reference"
]);

const canonicalField = (
  input: unknown,
  path: string,
  ancestors: ReadonlySet<object>
): Field => {
  if (!isRecord(input)) {
    throw new DataManagerError("invalid-schema", `${path} must be a field definition`);
  }
  return {
    name: canonicalName(input.name, `${path}.name`),
    type: canonicalType(input.type, `${path}.type`, ancestors)
  };
};

const canonicalFields = (
  input: unknown,
  path: string,
  ancestors: ReadonlySet<object>
): readonly Field[] => {
  if (!Array.isArray(input)) {
    throw new DataManagerError("invalid-schema", `${path} must be an array`);
  }
  const names = new Set<string>();
  return input.map((field, index) => {
    const canonical = canonicalField(field, `${path}[${index}]`, ancestors);
    const key = nameKey(canonical.name);
    if (names.has(key)) {
      throw new DataManagerError(
        "invalid-schema",
        `${path} contains duplicate field '${canonical.name}'`
      );
    }
    names.add(key);
    return canonical;
  });
};

/**
 * Admits a declared type recursively. `ancestors` carries the input objects
 * already open on the current branch, which is how a self-referencing schema is
 * rejected instead of recursing forever.
 */
export const canonicalType = (
  input: unknown,
  path: string,
  ancestors: ReadonlySet<object>
): ValueType => {
  if (!isRecord(input) || typeof input.kind !== "string") {
    throw new DataManagerError("invalid-type", `${path} must have a supported kind`);
  }
  if (SCALAR_KINDS.has(input.kind)) {
    return { kind: input.kind } as ScalarType;
  }
  if (!["scalar", "list", "record", "table"].includes(input.kind)) {
    throw new DataManagerError(
      "invalid-type",
      `${path} has unsupported kind '${input.kind}'`
    );
  }
  if (ancestors.has(input)) {
    throw new DataManagerError("invalid-schema", `${path} contains a schema cycle`);
  }
  const nestedAncestors = new Set(ancestors);
  nestedAncestors.add(input);

  if (input.kind === "scalar" || input.kind === "list") {
    return {
      kind: input.kind,
      field: canonicalField(input.field, `${path}.field`, nestedAncestors)
    };
  }
  if (input.kind === "record" || input.kind === "table") {
    return {
      kind: input.kind,
      fields: canonicalFields(input.fields, `${path}.fields`, nestedAncestors)
    };
  }
  throw new DataManagerError("invalid-type", `${path} has an unsupported kind`);
};
