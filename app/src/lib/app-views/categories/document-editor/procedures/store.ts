import { username } from "$capabilities/development/index.remote";
import { read } from "$capabilities/store/index.remote";
import type { TableName, TableRow } from "$representation/store/tables";

export type TableQuery = ReturnType<typeof read>;

export const tableQuery = (table: TableName): TableQuery => read({ path: table });

export const rowsOf = <T extends TableName>(query: TableQuery, table: T): readonly TableRow<T>[] => {
  if (!query.ready) return [];

  const found = query.current;
  return found?.kind === "table" && found.table === table
    ? (found.rows as unknown as readonly TableRow<T>[])
    : [];
};

export const rowsIn = <T extends TableName>(table: T): readonly TableRow<T>[] =>
  rowsOf(read({ path: table }), table);

export const fieldIn = (path: string): unknown => {
  const answer = read({ path });
  if (!answer.ready) return undefined;

  const found = answer.current;
  return found?.kind === "field" ? found.value : undefined;
};

export const projectIdOf = (documentId: string | undefined): string => {
  if (documentId === undefined) return "";
  const found = fieldIn(`documents.${documentId}.projectId`);
  return typeof found === "string" ? found : "";
};

export const viewerId = (): string => {
  const answer = username();
  if (!answer.ready) return "";

  const name = answer.current;
  return rowsIn("users").find((user) => user.displayName === name)?._id ?? "";
};

export const refreshAll = (...queries: readonly TableQuery[]): Promise<void> =>
  Promise.all(queries.map((query) => query.refresh())).then(() => undefined);
