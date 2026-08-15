import type { Selectable } from "kysely";
import type { SettingsTable } from "$settings/persistence/tables";
import type { Setting } from "$settings/types/settings";

/** A `settings` row exactly as selected. */
export type StoredSetting = Selectable<SettingsTable>;

/**
 * Row to canonical.
 *
 * The `value` copy is not decoration. `jsonb` arrives as a live object graph the
 * driver just built, and handing it straight out would let a consumer mutate
 * something a later reader also holds. Copying at the boundary means a caller
 * can do what it likes with what it receives.
 */
export const currentSetting = (row: StoredSetting): Setting => ({
  key: row.key,
  value: structuredClone(row.value) as Setting["value"],
  updatedBy: row.updated_by,
  updatedAt: row.updated_at
});
