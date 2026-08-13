import type { Generated, JSONColumnType } from "kysely";
import type { StoredRawContent } from "#rich-content/persistence/stored-types.js";

export interface RichContentTable {
  id: string;
  revision: number;
  raw_content: JSONColumnType<StoredRawContent>;
  updated_at: Generated<Date>;
}

/**
 * Declaration merging must name the module that declares `BackendDatabase`,
 * not Platform Persistence's `index.js` re-export, so this is the one import
 * specifier in the capability that reaches past another capability's index.
 */
declare module "#persistence/types/database.js" {
  interface BackendDatabase {
    rich_content: RichContentTable;
  }
}
