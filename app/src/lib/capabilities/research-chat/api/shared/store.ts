import {
  readCurrentRows,
  type StoreUnitOfWork,
  type TableName,
  type TableRow
} from "$model/server/store/index.server";
import type { Scope } from "$runtime/server/scope.server";
import type { Actor } from "$representation/data/types/core/actor";
import { asId } from "$representation/data/behavior/core/id";

export const rowsIn = <T extends TableName>(store: StoreUnitOfWork, table: T): readonly TableRow<T>[] => {
  return readCurrentRows(store, table);
};

export const uniqueId = (): string => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

export const viewer = (scope: Scope): Actor => ({
  kind: "user",
  userId: asId<"users">(scope.userId)
});

export const threadsIn = (store: StoreUnitOfWork, projectId: string) =>
  rowsIn(store, "researchThreads").filter((row) => row.projectId === projectId);

export const turnsIn = (store: StoreUnitOfWork, projectId: string, researchThreadId: string) =>
  rowsIn(store, "researchTurns")
    .filter((row) => row.projectId === projectId && row.researchThreadId === researchThreadId)
    .toSorted((left, right) => left.askedAt - right.askedAt);
