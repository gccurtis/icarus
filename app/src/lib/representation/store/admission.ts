import { TABLE_NAMES, type TableName } from "$representation/store/tables";
import type { Id } from "$representation/data/types/core/id";

/**
 * What the store checks before it acts on a name it did not mint.
 *
 * Wherever the value came from, its type is a claim rather than a check. These
 * two are the claims that cannot be left as claims: a table name becomes a path
 * segment, and a row id becomes a map key.
 *
 * The caller that used to sit in front of this was a remote function here, and
 * it has been removed — a public surface belongs in `capabilities/`, not in the
 * vocabulary. These stay because the guard is the store's, not the door's.
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
