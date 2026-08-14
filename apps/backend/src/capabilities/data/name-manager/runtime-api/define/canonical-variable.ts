import { NameManagerError } from "#name-manager/errors.js";
import { canonicalType } from "#name-manager/runtime-api/define/canonical-type.js";
import { canonicalValue } from "#name-manager/runtime-api/define/canonical-value.js";
import {
  invalidValue,
  isRecord
} from "#name-manager/runtime-api/define/value-guards.js";
import { canonicalName } from "#name-manager/runtime-api/shared/canonical-name.js";
import type { TableType } from "#name-manager/types/schema.js";
import type {
  NamedVariable,
  NamedVariableInput
} from "#name-manager/types/variables.js";

/**
 * Turns one authored declaration into its canonical form, or fails. A top-level
 * variable must declare an explicit table shape; a bare scalar kind is rejected
 * here rather than being wrapped, so the author's intent is never guessed.
 */
export const canonicalVariable = (input: NamedVariableInput): NamedVariable => {
  if (!isRecord(input)) return invalidValue("variable", "an object declaration");
  const name = canonicalName(input.name, "variable.name");
  const type = canonicalType(input.type, "variable.type", new Set());
  if (!["scalar", "list", "record", "table"].includes(type.kind)) {
    throw new NameManagerError(
      "invalid-type",
      "A named variable must have a scalar, list, record, or table type"
    );
  }
  const tableType = type as TableType;
  const value = canonicalValue(tableType, input.value, `variable '${name}'`, new Set());
  return { name, type: tableType, value } as NamedVariable;
};
