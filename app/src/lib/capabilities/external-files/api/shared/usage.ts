import type { StoreModel } from "$model/server/store/index.server";
import type { Scope } from "$runtime/server/start.server";
import type {
  ExternalFileUsage,
  ExternalFileUsageItem,
  ExternalFileUsageKind
} from "$capabilities/external-files/types/external-files";
import { rowsOf } from "$capabilities/external-files/api/shared/rows";

const contains = (value: unknown, externalFileId: string): boolean => {
  if (value === externalFileId) return true;
  if (Array.isArray(value)) return value.some((entry) => contains(entry, externalFileId));
  if (value === null || typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).some((entry) =>
    contains(entry, externalFileId)
  );
};

const unique = (items: readonly ExternalFileUsageItem[]): ExternalFileUsageItem[] =>
  [...new Map(items.map((item) => [`${item.kind}:${item.id}`, item])).values()];

export const externalFileUsage = (
  store: StoreModel,
  scope: Scope,
  externalFileId: string
): ExternalFileUsage => {
  const items: ExternalFileUsageItem[] = [];
  const push = (kind: ExternalFileUsageKind, id: string, name: string) =>
    items.push({ kind, id, name });

  const documents = new Map(rowsOf(store, "documents")
    .filter((row) => row.projectId === scope.projectId)
    .map((row) => [row._id, row.title]));
  for (const snapshot of rowsOf(store, "documentSnapshots")) {
    if (snapshot.projectId !== scope.projectId || !contains(snapshot.body, externalFileId)) continue;
    push("document", snapshot.resourceId, documents.get(snapshot.resourceId) ?? "Untitled document");
  }

  const decks = new Map(rowsOf(store, "slideDecks")
    .filter((row) => row.projectId === scope.projectId)
    .map((row) => [row._id, row.title]));
  for (const snapshot of rowsOf(store, "slideDeckSnapshots")) {
    if (snapshot.projectId !== scope.projectId || !contains(snapshot.body, externalFileId)) continue;
    push("slide-deck", snapshot.resourceId, decks.get(snapshot.resourceId) ?? "Untitled deck");
  }

  let restrictedTemplate = 0;
  for (const template of rowsOf(store, "templates")) {
    if (!contains(template.body, externalFileId)) continue;
    if (template.userId === scope.userId) {
      push("template", template._id, template.name);
    } else {
      restrictedTemplate += 1;
      push("template", `restricted-${restrictedTemplate}`, "A private template");
    }
  }
  for (const set of rowsOf(store, "resourceSets")) {
    if (set.projectId === scope.projectId && contains(set.set, externalFileId)) {
      push("resource-set", set._id, set.name);
    }
  }
  for (const finding of rowsOf(store, "findings")) {
    if (finding.projectId === scope.projectId && contains(finding.sources, externalFileId)) {
      push("finding", finding._id, finding.title);
    }
  }
  const held = unique(items).sort((left, right) =>
    left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name)
  );
  return { total: held.length, items: held };
};
