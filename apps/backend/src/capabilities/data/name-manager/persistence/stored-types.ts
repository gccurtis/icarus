import type { TableType } from "#name-manager/types/schema.js";
import type { DataValue } from "#name-manager/types/values.js";
import type { NamedVariable } from "#name-manager/types/variables.js";

/** The declaration fields stored beside a row's project, key, and order. */
export interface StoredNamedVariable {
  readonly name: string;
  readonly declaredType: TableType;
  readonly value: DataValue;
}

/** Canonical to stored. JSON serialization happens in the store. */
export const storedNamedVariable = (
  variable: NamedVariable
): StoredNamedVariable => ({
  name: variable.name,
  declaredType: variable.type,
  value: variable.value
});

/** Stored to canonical, copying JSON-backed values before they leave storage. */
export const currentNamedVariable = (
  stored: StoredNamedVariable
): NamedVariable =>
  structuredClone({
    name: stored.name,
    type: stored.declaredType,
    value: stored.value
  }) as NamedVariable;
