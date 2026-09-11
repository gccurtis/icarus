import type { ReadExternalFileResult } from "$capabilities/external-files/index.remote";
import {
  presentExternalFile,
  type LibraryExternalFileDetail
} from "$app-views/categories/external/procedures/library-query";

export const detailIn = (
  answer: ReadExternalFileResult | undefined,
  now: number
): LibraryExternalFileDetail | undefined => {
  if (answer === null || answer === undefined) return undefined;
  return { ...answer, ...presentExternalFile(answer, now) };
};

export const selectedExternalFileIdIn = (
  selectedId: string | undefined,
  availableIds: readonly string[]
): string | undefined => selectedId !== undefined && availableIds.includes(selectedId)
  ? selectedId
  : undefined;

export const directoryOf = (relativePath: string): string => {
  const separator = relativePath.lastIndexOf("/");
  return separator < 0 ? "" : relativePath.slice(0, separator);
};
