import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { AnyRow } from "$representation/store/path";
import { TABLE_NAMES, type TableName } from "$representation/store/tables";

export const pathFor = (directory: string, table: TableName): string =>
  join(directory, `${table}.json`);

/** Every table, read once. A table with no file starts empty. */
export const load = (directory?: string): Map<TableName, readonly AnyRow[]> => {
  const tables = new Map<TableName, readonly AnyRow[]>();
  for (const table of TABLE_NAMES) {
    const path = directory === undefined ? undefined : pathFor(directory, table);
    tables.set(
      table,
      path !== undefined && existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as AnyRow[]) : []
    );
  }
  return tables;
};
