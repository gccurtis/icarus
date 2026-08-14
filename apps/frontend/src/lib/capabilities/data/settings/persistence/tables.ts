import type { ColumnType } from "kysely";
import type { SettingValue } from "$settings/types/settings";

/**
 * The one table Settings owns.
 *
 * **No `project_id` column.** A project is its own database, so scoping is
 * structural: there is no predicate to write and therefore none to forget. A
 * column here would mean the wrong model had been imported along with the code.
 *
 * `key` is the primary key rather than a generated id. A setting *is* its key —
 * there is no second thing to name, and a surrogate would let two rows claim the
 * same key.
 */
export interface SettingsTable {
  key: string;
  /**
   * Written as a JSON string, read back as a parsed value.
   *
   * `ColumnType` rather than Kysely's `JSONColumnType`, which constrains what it
   * selects to `object | null`. A setting may legitimately be a bare `true` or
   * `3`, and `jsonb` stores a scalar perfectly well.
   */
  value: ColumnType<SettingValue, string, string>;
  /** From `scope.userId`. Never from an input — see `types/settings.ts`. */
  updated_by: string;
  updated_at: ColumnType<Date, Date, Date>;
}

/**
 * Declaration merging must name the module that declares `Database`, not a door
 * that re-exports it — this is the one place the bare-alias rule does not apply,
 * and it is structural rather than stylistic.
 */
declare module "$runtime/server/persistence/types" {
  interface Database {
    settings: SettingsTable;
  }
}
