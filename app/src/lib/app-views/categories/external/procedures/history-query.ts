import type { LibraryExternalHistoryEntry } from "$app-views/categories/external/procedures/library-query";

export const externalHistoryLabel = (event: LibraryExternalHistoryEntry["event"]): string => ({
  uploaded: "Uploaded",
  "re-uploaded": "Re-uploaded",
  renamed: "Renamed",
  moved: "Moved",
  deleted: "Deleted",
  "context-updated": "Updated context for"
})[event];

export const matchingExternalHistory = (
  entries: readonly LibraryExternalHistoryEntry[],
  search: string
): readonly LibraryExternalHistoryEntry[] => {
  const terms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return entries;
  return entries.filter((entry) => {
    const text = [
      externalHistoryLabel(entry.event), entry.name, entry.relativePath,
      entry.actorName, entry.detail ?? ""
    ].join(" ").toLocaleLowerCase();
    return terms.every((term) => text.includes(term));
  });
};
