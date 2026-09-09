import type { TableQuery } from "$app-views/categories/spreadsheet-editor/procedures/store";

export const refreshAll = (...queries: readonly TableQuery[]): Promise<void> =>
  Promise.all(queries.map((query) => query.refresh())).then(() => undefined);
