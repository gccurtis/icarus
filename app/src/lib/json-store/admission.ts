import { TABLE_NAMES, type TableName } from "$json-store/tables";
import type { Id } from "$json-store/types/core/id";

/**
 * What a remote function checks before it does anything else.
 *
 * Admission is `'unchecked'`, so a payload's type is a claim rather than a
 * check. These two are the claims that cannot be left as claims: a table name
 * becomes a path segment, and a row id becomes a map key.
 */

/** A name the store actually has. An unvalidated one reads and writes outside the data directory. */
export const asTable = (value: unknown): TableName => {
  if (typeof value === "string" && (TABLE_NAMES as readonly string[]).includes(value)) {
    return value as TableName;
  }
  throw new Error("No such table");
};

export const asRowId = <T extends TableName>(value: unknown): Id<T> => {
  if (typeof value !== "string") throw new Error("A row id is a string");
  return value as Id<T>;
};
