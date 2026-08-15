import type { ColumnType, Generated, JSONColumnType } from "kysely";
import type { TableType } from "$name-manager/types/schema";
import type { DataValue } from "$name-manager/types/values";

/**
 * The one table Name Manager owns: a project's catalog of named variables.
 *
 * **No `project_id` column.** A project is its own database, so scoping is
 * structural: there is no predicate to write and therefore none to forget. The
 * backend carried one, and with it a composite key and a `where` clause on every
 * statement — all of which this drops rather than ports.
 *
 * `name_key` is the primary key. A variable *is* its name, and the key is the
 * lowercased form so that two declarations differing only in casing collide
 * instead of both landing. The authored casing survives beside it in `name`.
 */
export interface NameManagerVariablesTable {
  /** Lowercased lookup form. Derived from `name` by `canonicalName`/`nameKey`. */
  name_key: string;
  /** Authored casing, returned to callers unchanged. */
  name: string;
  declared_type: JSONColumnType<TableType>;
  /**
   * Written as a JSON string, read back as a parsed value.
   *
   * `ColumnType` rather than Kysely's `JSONColumnType`, which constrains what it
   * selects to `object | null`. A variable may legitimately hold a bare `true`
   * or `3`, and `jsonb` stores a scalar perfectly well.
   */
  value: ColumnType<DataValue, string, string>;
  /**
   * Assigned by the database, and the order `list` returns.
   *
   * Naturally per-project now that a project is a database — the backend had to
   * index it alongside `project_id` to get the same answer.
   */
  definition_order: Generated<number>;
}

/**
 * Declaration merging must name the module that declares `Database`, not a door
 * that re-exports it — this is the one place the bare-alias rule does not apply,
 * and it is structural rather than stylistic.
 */
declare module "$model/server/persistence/types" {
  interface Database {
    name_manager_variables: NameManagerVariablesTable;
  }
}
