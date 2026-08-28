import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type { AnyRow } from "$representation/store/path";
import type { TableName } from "$representation/store/tables";

import { pathFor } from "$model/server/store/methods/shared/load.server";

/** One table is one file, written whole. Synchronous, so nothing lands half-written. */
export const persist = (directory: string | undefined, table: TableName, rows: readonly AnyRow[]): void => {
  if (directory === undefined) return;
  const path = pathFor(directory, table);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(rows, null, 2)}\n`);
};
