import type { AnyRow } from "$representation/store/path";
import type { TableName } from "$representation/store/tables";

import { writeDurableFile } from "$model/server/store/methods/shared/durable-file.server";
import { pathFor } from "$model/server/store/methods/shared/load.server";

/** One table is one file, replaced only after its complete next value is durable. */
export const persist = (directory: string | undefined, table: TableName, rows: readonly AnyRow[]): void => {
  if (directory === undefined) return;
  const path = pathFor(directory, table);
  writeDurableFile(path, `${JSON.stringify(rows, null, 2)}\n`);
};
