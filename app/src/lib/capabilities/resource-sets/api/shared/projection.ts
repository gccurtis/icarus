import type { StoreModel, TableName, TableRow } from "$model/server/store/index.server";
import type { Scope } from "$runtime/server/scope.server";
import { resolveResourceSet } from "$representation/data/behavior/core/resource-set";
import type { Actor } from "$representation/data/types/core/actor";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { ResourceSet } from "$representation/data/types/core/resource-set";

import {
  descriptionOf,
  nameOf,
  resourceSetOf,
  setIdOf
} from "$capabilities/resource-sets/api/shared/validation";
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

export const recordsIn = (
  store: StoreModel,
  table: TableName
): readonly Record<string, unknown>[] => {
  const found = store.read(table);
  if (found?.table !== table || found.kind !== "table" || !Array.isArray(found.rows)) return [];
  return found.rows.flatMap((value) => {
    const record = recordOf(value);
    return record === undefined ? [] : [record];
  });
};

export const reportableRevision = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;

const actorOf = (value: unknown, subject: string): Actor => {
  const actor = recordOf(value);
  const identifier = (candidate: unknown): candidate is string =>
    typeof candidate === "string" && candidate === candidate.trim() && candidate.length > 0 && candidate.length <= 500;
  const exact = (fields: readonly string[]) =>
    actor !== undefined && Object.keys(actor).every((field) => fields.includes(field));
  if (actor?.kind === "system" && exact(["kind"])) return { kind: "system" };
  if (actor?.kind === "user" && exact(["kind", "userId"]) && identifier(actor.userId)) {
    return value as Actor;
  }
  if (actor?.kind === "connector" && exact(["kind", "connectorId"]) && identifier(actor.connectorId)) {
    return value as Actor;
  }
  if (actor?.kind === "agent" && exact(["kind", "taskId"]) && identifier(actor.taskId)) {
    return value as Actor;
  }
  throw new Error(`resource-sets/${subject}: createdBy is a represented actor`);
};

export const admitStoredSet = (row: NamedSet): NamedSet => {
  const subject = `stored-${row._id}`;
  setIdOf(row._id, subject);
  if (typeof row.projectId !== "string" || row.projectId.length === 0) {
    throw new Error(`resource-sets/${subject}: projectId is required`);
  }
  if (!Number.isSafeInteger(row.revision) || row.revision < 1) {
    throw new Error(`resource-sets/${subject}: revision is safe and positive`);
  }
  if (!Number.isFinite(row.updatedAt) || row.updatedAt < 0) {
    throw new Error(`resource-sets/${subject}: updated time is finite`);
  }
  const description = row.description === undefined ? undefined : descriptionOf(row.description, subject);
  return {
    ...row,
    name: nameOf(row.name, subject),
    ...(description === undefined ? {} : { description }),
    set: resourceSetOf(row.set, subject),
    createdBy: actorOf(row.createdBy, subject)
  };
};

export const visibleSet = (store: StoreModel, scope: Scope, setId: string): SetLookup => {
  const matching = recordsIn(store, "resourceSets").filter((row) => row._id === setId);
  const visible = matching.filter((row) => row.projectId === scope.projectId);
  if (visible.length === 0) return { kind: "missing" };
  if (matching.length !== 1) {
    return { kind: "ambiguous", detail: "more than one stored row claims this set id" };
  }
  return { kind: "found", set: visible[0] as unknown as NamedSet };
};

const CATALOGUE: readonly { table: TableName; kind: string }[] = [
  { table: "documents", kind: "document" },
  { table: "slideDecks", kind: "slides" },
  { table: "spreadsheets", kind: "spreadsheet" },
  { table: "findings", kind: "finding" },
  { table: "researchThreads", kind: "research" }
];

export const catalogueOf = (store: StoreModel, projectId: string): readonly ResourceRef[] => {
  const staged = new Set(
    recordsIn(store, "templateStages")
      .filter((row) => row.projectId === projectId && typeof row.resourceId === "string")
      .map((row) => row.resourceId as string)
  );
  return CATALOGUE.flatMap(({ table, kind }) =>
    recordsIn(store, table)
      .filter(
        (row) =>
          row.projectId === projectId && typeof row._id === "string" && !staged.has(row._id)
      )
      .map((row) => ({ kind, id: row._id as string }))
  );
};

export const namedSetsIn = (store: StoreModel, projectId: string): ReadonlyMap<string, ResourceSet> => {
  const sets = new Map<string, ResourceSet>();
  for (const row of recordsIn(store, "resourceSets")) {
    if (row.projectId !== projectId || typeof row._id !== "string") continue;
    try {
      sets.set(row._id, resourceSetOf(row.set, `stored-${row._id}`));
    } catch {
      continue;
    }
  }
  return sets;
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
  name: set.name,
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
  const unavailable: ResourceSetUnavailable[] = [];
  const rows = recordsIn(store, "resourceSets");
  const claims = new Map<string, number>();
  for (const row of rows) {
    if (typeof row._id === "string") claims.set(row._id, (claims.get(row._id) ?? 0) + 1);
  }
  for (const [index, row] of rows.entries()) {
    if (row.projectId !== scope.projectId) continue;
    const reportId = typeof row._id === "string" && row._id.length <= 500 ? row._id : `resourceSets:invalid-${index + 1}`;
    if (typeof row._id === "string" && (claims.get(row._id) ?? 0) > 1) {
      unavailable.push({ setId: reportId, reason: "corrupt", detail: "more than one stored row claims this set id" });
      continue;
    }
    try {
      sets.push(itemOf(store, scope, admitStoredSet(row as unknown as NamedSet), catalogue, named));
    } catch (error) {
      unavailable.push({
        setId: reportId,
        reason: "corrupt",
        detail: error instanceof Error ? error.message : String(error)
      });
    }
  }
  sets.sort((left, right) => left.name.localeCompare(right.name));
  return { sets, unavailable };
};
