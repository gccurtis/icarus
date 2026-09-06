import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type { AnyRow } from "$representation/store/path";
import type { TableName } from "$representation/store/tables";

import { pathFor } from "$model/server/store/methods/shared/load.server";

/** One table is one file, replaced whole after its complete next value reaches disk. */
export const persist = (directory: string | undefined, table: TableName, rows: readonly AnyRow[]): void => {
  if (directory === undefined) return;
  const path = pathFor(directory, table);
  const next = `${path}.next`;
  mkdirSync(dirname(path), { recursive: true });
  try {
    writeFileSync(next, `${JSON.stringify(rows, null, 2)}\n`);
    renameSync(next, path);
  } catch (error) {
    rmSync(next, { force: true });
    throw error;
  }
};
