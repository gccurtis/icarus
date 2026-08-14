import type { ColumnType, Generated, JSONColumnType } from "kysely";
import type { TableType } from "#name-manager/types/schema.js";
import type { DataValue } from "#name-manager/types/values.js";

/** One canonical named-variable declaration in one project's catalog. */
export interface NameManagerVariablesTable {
  project_id: string;
  name_key: string;
  name: string;
  declared_type: JSONColumnType<TableType>;
  value: ColumnType<DataValue, string, string>;
  definition_order: Generated<number>;
}

/**
 * Declaration merging must name the module that declares `BackendDatabase`,
 * not Platform Persistence's index re-export.
 */
declare module "#persistence/types/database.js" {
  interface BackendDatabase {
    name_manager_variables: NameManagerVariablesTable;
  }
}
