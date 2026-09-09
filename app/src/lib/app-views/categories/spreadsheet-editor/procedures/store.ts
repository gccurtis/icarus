import type { TableName, TableRow } from "$representation/store/tables";
import { create, read, update } from "$capabilities/store/index.remote";
import { readStore, readUsername } from "$model/client/workspace-state";

export type TableQuery = ReturnType<typeof readStore>;

export type FieldQuery = ReturnType<typeof read>;

export const titleQuery = (sheetId: string): FieldQuery => read({ path: `spreadsheets.${sheetId}.title` });

export const titleOf = (query: FieldQuery | undefined): string => {
  if (query === undefined || !query.ready) return "";

  const found = query.current;
  return found?.kind === "field" && typeof found.value === "string" ? found.value : "";
};

export const renameSheet = async (sheetId: string, title: string): Promise<void> => {
  await update({ path: `spreadsheets.${sheetId}.title`, value: title });
};

export const createRow = async <T extends TableName>(
  table: T,
  fields: Record<string, unknown>
): Promise<{ id: string }> => create({ table, fields } as Parameters<typeof create>[0]);

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
