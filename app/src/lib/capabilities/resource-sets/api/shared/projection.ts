import {
  readCurrentRows,
  type StoreModel,
  type TableName,
  type TableRow
} from "$model/server/store/index.server";
import type { Scope } from "$runtime/server/scope.server";
import { resolveResourceSet } from "$representation/data/behavior/core/resource-set";
import {
  admitReusableResourceSetRow,
  admittedReusableResourceSets
} from "$representation/data/behavior/core/resource-set-rows";
import type { Actor } from "$representation/data/types/core/actor";
import type { ResourceRef } from "$representation/data/types/core/resource";
import {
  externalFileResourceKind,
  isResourceRef
} from "$representation/data/behavior/core/resource";
import type { ResourceSet } from "$representation/data/types/core/resource-set";

import type {
  ResourceSetItem,
  ResourceSetUnavailable
} from "$capabilities/resource-sets/types/resource-sets";

type NamedSet = TableRow<"resourceSets">;

export type SetLookup =
  | { readonly kind: "found"; readonly set: NamedSet }
  | { readonly kind: "missing" }
  | { readonly kind: "ambiguous"; readonly detail: string };

const recordOf = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const currentRowsIn = <T extends TableName>(
  store: StoreModel,
  table: T
): readonly TableRow<T>[] => {
  return readCurrentRows(store, table);
};

export const recordsIn = (
  store: StoreModel,
  table: TableName
): readonly Record<string, unknown>[] => {
  return currentRowsIn(store, table).map((value) => {
    const record = recordOf(value);
    if (record === undefined) throw new Error(`the '${table}' table contains a non-current row`);
    return record;
  });
};

export const reportableRevision = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;

export const admitStoredSet = (row: NamedSet): NamedSet =>
  admitReusableResourceSetRow(row);

export const visibleSet = (store: StoreModel, scope: Scope, setId: string): SetLookup => {
  const matching = recordsIn(store, "resourceSets").filter((row) => row._id === setId);
  const visible = matching.filter((row) => row.projectId === scope.projectId);
  if (visible.length === 0) return { kind: "missing" };
  if (matching.length !== 1 || visible.length !== 1) {
    return { kind: "ambiguous", detail: "more than one stored row claims this set id" };
  }
  if (visible[0]?.name === undefined && visible[0]?.boundTo !== undefined) {
    return { kind: "missing" };
  }
  return { kind: "found", set: visible[0] as unknown as NamedSet };
};

export const catalogueOf = (store: StoreModel, projectId: string): readonly ResourceRef[] => {
  const staged = new Set(
    recordsIn(store, "templateStages")
      .filter((row) => row.projectId === projectId && typeof row.resourceId === "string")
      .map((row) => row.resourceId as string)
  );
  const candidates = [
    ...recordsIn(store, "documents").filter((row) => row.projectId === projectId)
      .map((row) => ({ kind: "document", id: row._id })),
    ...recordsIn(store, "slideDecks").filter((row) => row.projectId === projectId)
      .map((row) => ({ kind: "slides", id: row._id })),
    ...recordsIn(store, "spreadsheets").filter((row) => row.projectId === projectId)
      .map((row) => ({ kind: "spreadsheet", id: row._id })),
    ...recordsIn(store, "findings").filter((row) => row.projectId === projectId)
      .map((row) => ({ kind: "finding", id: row._id })),
    ...recordsIn(store, "researchThreads").filter((row) => row.projectId === projectId)
      .map((row) => ({ kind: "research", id: row._id })),
    ...recordsIn(store, "connectors").filter((row) => row.projectId === projectId)
      .map((row) => ({ kind: "connection", id: row._id })),
    ...currentRowsIn(store, "externalFiles").filter((row) => row.projectId === projectId)
      .map((row) => ({
      kind: externalFileResourceKind(row.subkind),
      id: row._id
    }))
  ];
  return candidates.filter(
    (candidate): candidate is ResourceRef =>
      isResourceRef(candidate) && !staged.has(candidate.id)
  );
};

export const namedSetsIn = (store: StoreModel, projectId: string): ReadonlyMap<string, ResourceSet> => {
  const reusable = admittedReusableResourceSets(recordsIn(store, "resourceSets"), projectId);
  return new Map([...reusable].map(([id, row]) => [id, row.set]));
};

const namedRow = (
  store: StoreModel,
  table: "users" | "connectors" | "agentTasks",
  id: string,
  field: "displayName" | "name" | "title",
  projectId?: string
): string | undefined => {
  const row = recordsIn(store, table).find(
    (candidate) => candidate._id === id && (projectId === undefined || candidate.projectId === projectId)
  );
  const value = row?.[field];
  return typeof value === "string" && value === value.trim() && value.length > 0 && value.length <= 160
    ? value
    : undefined;
};

const actorName = (store: StoreModel, scope: Scope, actor: Actor): string => {
  if (actor.kind === "system") return "Icarus";
  if (actor.kind === "user") {
    const member = recordsIn(store, "memberships").some(
      (row) => row.projectId === scope.projectId && row.userId === actor.userId
    );
    return member ? (namedRow(store, "users", actor.userId, "displayName") ?? "Someone") : "Someone";
  }
  if (actor.kind === "connector") {
    return namedRow(store, "connectors", actor.connectorId, "name", scope.projectId) ?? "A connector";
  }
  const title = namedRow(store, "agentTasks", actor.taskId, "title", scope.projectId);
  return title === undefined ? "An agent" : `Agent · ${title}`;
};

export const itemOf = (
  store: StoreModel,
  scope: Scope,
  set: NamedSet,
  catalogue: readonly ResourceRef[],
  sets: ReadonlyMap<string, ResourceSet>
): ResourceSetItem => ({
  id: set._id,
  name: set.name ?? "",
  ...(set.description === undefined ? {} : { description: set.description }),
  set: set.set,
  createdByName: actorName(store, scope, set.createdBy),
  revision: set.revision,
  updatedAt: set.updatedAt,
  resolves: resolveResourceSet(set.set, catalogue, sets).length
});

export const projectSets = (
  store: StoreModel,
  scope: Scope
): { readonly sets: readonly ResourceSetItem[]; readonly unavailable: readonly ResourceSetUnavailable[] } => {
  const catalogue = catalogueOf(store, scope.projectId);
  const named = namedSetsIn(store, scope.projectId);
  const sets: ResourceSetItem[] = [];
  const rows = recordsIn(store, "resourceSets");
  for (const row of rows) {
    if (row.projectId !== scope.projectId) continue;
    if (row.name === undefined) continue;
    sets.push(itemOf(store, scope, admitStoredSet(row as unknown as NamedSet), catalogue, named));
  }
  sets.sort((left, right) => left.name.localeCompare(right.name));
  return { sets, unavailable: [] };
};
