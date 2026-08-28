import type { Id } from "$representation/data/types/core/id";
import type { Found } from "$representation/store/path";
import type { TableName } from "$representation/store/tables";

/**
 * Every table, for the life of the process.
 *
 * A path is a string, so a caller's type cannot follow it: what goes in is
 * `unknown` and what comes back is `Found`, which names the table it came from.
 * What a field holds is the calling procedure's to check.
 */
export interface StoreModel {
  create<T extends TableName>(table: T, fields: unknown): Id<T>;
  read(path: string): Found | undefined;
  update(path: string, value: unknown): void;
  remove(path: string): void;
}

export type StoreInput = {
  /** Where the tables live. Absent keeps every table in memory. */
  readonly directory?: string;
  readonly now?: () => number;
};
