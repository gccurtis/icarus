import type { Generated, JSONColumnType } from "kysely";
import type { StoredRawContent } from "$rich-content/persistence/stored-types";

/**
 * The one table Rich Content owns.
 *
 * **`revision` is a column rather than part of the document** because every
 * mutation compare-and-swaps on it: `where revision = expected` is what makes a
 * concurrent write lose instead of overwrite, and a value buried inside `jsonb`
 * could not carry that predicate.
 *
 * **No `project_id`, and there never was one.** The backend's version of this
 * table had no project column either — which under one user was invisible and
 * under many meant content belonged to nobody. A database per project fixes that
 * for free: scoping is structural, so there is no predicate to write and none to
 * forget.
 */
export interface RichContentTable {
  id: string;
  revision: number;
  raw_content: JSONColumnType<StoredRawContent>;
  updated_at: Generated<Date>;
}

/**
 * Declaration merging must name the module that declares `Database`, not a door
 * that re-exports it — this is the one place the bare-alias rule does not apply,
 * and it is structural rather than stylistic.
 */
declare module "$model/server/persistence/types" {
  interface Database {
    rich_content: RichContentTable;
  }
}
