import type { Selectable } from "kysely";
import type { NameManagerVariablesTable } from "$name-manager/persistence/tables";
import type { TableType } from "$name-manager/types/schema";
import type { DataValue } from "$name-manager/types/values";
import type { NamedVariable } from "$name-manager/types/variables";

/** A `name_manager_variables` row exactly as selected. */
export type StoredVariable = Selectable<NameManagerVariablesTable>;

/**
 * The three columns that carry a declaration, without the key or the order.
 *
 * A separate shape from the row because both conversions below work on exactly
 * these fields: `name_key` is derived from `name` and `definition_order` is the
 * database's to assign, so neither belongs in a round trip a caller controls.
 */
export interface StoredNamedVariable {
  readonly name: string;
  readonly declaredType: TableType;
  readonly value: DataValue;
}

/** Canonical to stored. JSON serialization happens in the procedure that writes. */
export const storedNamedVariable = (variable: NamedVariable): StoredNamedVariable => ({
  name: variable.name,
  declaredType: variable.type,
  value: variable.value
});

/**
 * Stored to canonical.
 *
 * The copy is not decoration. `jsonb` arrives as a live object graph the driver
 * just built, and handing it straight out would let a consumer mutate something
 * a later reader also holds. Copying at the boundary means a caller can do what
 * it likes with what it receives.
 */
export const currentNamedVariable = (stored: StoredNamedVariable): NamedVariable =>
  structuredClone({
    name: stored.name,
    type: stored.declaredType,
    value: stored.value
  }) as NamedVariable;

/** The projection every read shares: a selected row as a canonical declaration. */
export const currentVariable = (
  row: Pick<StoredVariable, "name" | "declared_type" | "value">
): NamedVariable =>
  currentNamedVariable({
    name: row.name,
    declaredType: row.declared_type,
    value: row.value
  });
