import type { ResourceTableRow } from "$authored-components/resource-table/types";
import type { ResourceTableState } from "$authored-components/resource-table/resource-table.state.svelte";

export const SORTS = [
  { value: "updated", label: "Updated" },
  { value: "name", label: "Name" },
  { value: "kind", label: "Kind" }
] as const;

export const DIRECTION: Record<string, { asc: string; desc: string }> = {
  updated: { asc: "Newest first", desc: "Oldest first" },
  name: { asc: "A to Z", desc: "Z to A" },
  kind: { asc: "A to Z", desc: "Z to A" }
};

export const WITHOUT_FILES = "all-but-file";

const compare = (
  a: ResourceTableRow,
  b: ResourceTableRow,
  sortBy: string,
  kindLabels: Readonly<Record<string, string>>
): number => {
  if (sortBy === "name") return a.name.localeCompare(b.name);
  if (sortBy === "kind") {
    return kindLabels[a.kind].localeCompare(kindLabels[b.kind]) || a.name.localeCompare(b.name);
  }
  return b.updatedAt - a.updatedAt;
};

/** Filter choices describe the whole project; listed rows reflect the current choices. */
export const tableRows = (
  resources: readonly ResourceTableRow[],
  filters: ResourceTableState,
  kindLabels: Readonly<Record<string, string>>,
  kindPlurals: Readonly<Record<string, string>>
) => {
  const search = filters.search.trim().toLowerCase();
  const filtered = resources.filter((row) =>
    (filters.kind === "all" ||
      (filters.kind === WITHOUT_FILES ? row.kind !== "file" : row.kind === filters.kind)) &&
    (filters.actor === "all" || row.updatedBy === filters.actor) &&
    row.name.toLowerCase().includes(search)
  );
  const ordered = [...filtered].sort((a, b) =>
    (filters.direction === "asc" ? 1 : -1) * compare(a, b, filters.sortBy, kindLabels)
  );
  return {
    listed: ordered,
    kinds: [...new Set(resources.map((row) => row.kind))].sort((a, b) =>
      kindPlurals[a].localeCompare(kindPlurals[b])
    ),
    actors: [...new Set(resources.map((row) => row.updatedBy))].sort((a, b) => a.localeCompare(b))
  };
};
