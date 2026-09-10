import {
  readProjectResourceIndex,
  renameProjectResource
} from "$capabilities/project-resources/index.remote";

export type ResourceIndexQuery = ReturnType<typeof readProjectResourceIndex>;
export type TitleQuery = { readonly id: string; readonly index: ResourceIndexQuery };

const resourceIndexQuery = (): ResourceIndexQuery => readProjectResourceIndex();

export const titleQuery = (sheetId: string): TitleQuery => ({ id: sheetId, index: resourceIndexQuery() });

export const titleOf = (query: TitleQuery | undefined): string =>
  query?.index.current?.resources.find((resource) => resource.id === query.id)?.name ?? "";

export const renameSheet = async (
  sheetId: string | undefined,
  next: string,
  title: string,
  query: TitleQuery | undefined
): Promise<void> => {
  const wanted = next.trim();
  if (sheetId === undefined || wanted === "" || wanted === title) return;

  await renameProjectResource({ resourceId: sheetId, title: wanted });
  await query?.index.refresh();
};
