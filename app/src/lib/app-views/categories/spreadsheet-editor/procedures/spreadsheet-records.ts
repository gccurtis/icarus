import { readProjectResourceIndex } from "$capabilities/project-resources/index.remote";

export type ResourceIndexQuery = ReturnType<typeof readProjectResourceIndex>;
export type SpreadsheetRecord = { readonly _id: string; readonly title: string };

export const resourceIndexQuery = (): ResourceIndexQuery => readProjectResourceIndex();

export const spreadsheetRecordsIn = (query: ResourceIndexQuery): readonly SpreadsheetRecord[] =>
  (query.current?.resources ?? []).flatMap((resource) =>
    resource.kind === "spreadsheet" ? [{ _id: resource.id, title: resource.name }] : []
  );
