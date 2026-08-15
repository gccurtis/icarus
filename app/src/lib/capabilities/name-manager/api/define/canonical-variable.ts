import { NameManagerError } from "$name-manager/errors";
import { canonicalType } from "$name-manager/api/define/canonical-type";
import { canonicalValue } from "$name-manager/api/define/canonical-value";
import { invalidValue, isRecord } from "$name-manager/api/define/value-guards";
import { canonicalName } from "$name-manager/api/shared/canonical-name";
import type { TableType } from "$name-manager/types/schema";
import type { NamedVariable, NamedVariableInput } from "$name-manager/types/variables";

/**
 * Turns one authored declaration into its canonical form, or fails.
 *
 * A top-level variable must declare an explicit **table shape**. A bare scalar
 * kind — `{ kind: "number" }` — is rejected here rather than wrapped in a scalar
 * table, because wrapping would be a guess about intent: a scalar and a
 * one-element list are different declarations, and the author is the only one
 * who knows which was meant.
 *
 * Pure: it touches no database and no clock, which is what lets the whole
 * admission tree be tested without one.
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
