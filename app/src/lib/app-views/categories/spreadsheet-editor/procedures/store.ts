import type { TableName, TableRow } from "$representation/store/tables";
import { readStore, readUsername } from "$model/client/workspace-state";

export type TableQuery = ReturnType<typeof readStore>;

export const tableQuery = (table: TableName): TableQuery => readStore(table);

export const rowsOf = <T extends TableName>(query: TableQuery, table: T): readonly TableRow<T>[] => {
  if (!query.ready) return [];

  const found = query.current;
  return found?.kind === "table" && found.table === table
    ? (found.rows as unknown as readonly TableRow<T>[])
    : [];
};

export const rowsIn = <T extends TableName>(table: T): readonly TableRow<T>[] =>
  rowsOf(readStore(table), table);

export const projectIdOf = (sheetId: string | undefined): string => {
  if (sheetId === undefined) return "";
  return rowsIn("spreadsheets").find((sheet) => sheet._id === sheetId)?.projectId ?? "";
};

export const viewerId = (): string => {
  const answer = readUsername();
  if (!answer.ready) return "";

  const name = answer.current;
  return rowsIn("users").find((user) => user.displayName === name)?._id ?? "";
};

export const refreshAll = (...queries: readonly TableQuery[]): Promise<void> =>
  Promise.all(queries.map((query) => query.refresh())).then(() => undefined);
