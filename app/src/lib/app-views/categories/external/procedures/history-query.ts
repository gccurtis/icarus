import type { LibraryExternalHistoryEntry } from "$app-views/categories/external/procedures/library-query";

export const matchingExternalHistory = (
  entries: readonly LibraryExternalHistoryEntry[],
  search: string
): readonly LibraryExternalHistoryEntry[] => {
  const terms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return entries;
  return entries.filter((entry) => {
    const text = [
      entry.type, entry.what, entry.action, entry.target.label, entry.context?.label ?? "",
      entry.name, entry.relativePath,
      entry.actorName, entry.detail ?? ""
    ].join(" ").toLocaleLowerCase();
    return terms.every((term) => text.includes(term));
  });
};
