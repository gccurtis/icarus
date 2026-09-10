import type { StoreModel, TableName, TableRow } from "$model/server/store/index.server";
import type { Scope } from "$runtime/server/scope.server";
import type { Actor } from "$representation/data/types/core/actor";
import { asId } from "$representation/data/behavior/core/id";
import {
  isStoredResearchThread,
  isStoredResearchTurn
} from "$representation/data/behavior/investigation/stored-rows";

export const rowsIn = <T extends TableName>(store: StoreModel, table: T): readonly TableRow<T>[] => {
  const found = store.read(table);
  if (found?.table !== table || found.kind !== "table" || !Array.isArray(found.rows)) return [];
  if (table === "researchThreads") {
    if (found.rows.every(isStoredResearchThread)) {
      return found.rows as unknown as readonly TableRow<T>[];
    }
    throw new Error("the researchThreads table contains a non-current row");
  }
  if (table === "researchTurns") {
    if (found.rows.every(isStoredResearchTurn)) {
      return found.rows as unknown as readonly TableRow<T>[];
    }
    throw new Error("the researchTurns table contains a non-current row");
  }
  return found.rows as readonly TableRow<T>[];
};

export const uniqueId = (): string => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

export const viewer = (scope: Scope): Actor => ({
  kind: "user",
  userId: asId<"users">(scope.userId)
});

export const threadsIn = (store: StoreModel, projectId: string) =>
  rowsIn(store, "researchThreads").filter((row) => row.projectId === projectId);

export const turnsIn = (store: StoreModel, projectId: string, researchThreadId: string) =>
  rowsIn(store, "researchTurns")
    .filter((row) => row.projectId === projectId && row.researchThreadId === researchThreadId)
    .toSorted((left, right) => left.askedAt - right.askedAt);
