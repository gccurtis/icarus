import type { StoreModel } from "$model/server/store/index.server";
import {
  isStoredMembership,
  isStoredUser
} from "$representation/data/behavior/core/stored-project";
import { storedFields } from "$representation/data/behavior/core/stored";
import type { CommentPersonRecord } from "$capabilities/comments/types/read-comments";

const countsOf = (
  rows: readonly Record<string, unknown>[],
  key: (row: Record<string, unknown>) => string | undefined
): ReadonlyMap<string, number> => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const id = key(row);
    if (id !== undefined) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
};

const recordsIn = (store: StoreModel, table: "users" | "memberships"): Record<string, unknown>[] => {
  const found = store.read(table);
  return found?.kind === "table" && found.table === table
    ? found.rows.flatMap((row) => {
        const fields = storedFields(row);
        return fields === undefined ? [] : [fields];
      })
    : [];
};

export type VisiblePeople = {
  readonly userIds: ReadonlySet<string>;
  readonly people: readonly CommentPersonRecord[];
};

/** Exact users with exactly one exact membership in the active project. */
export const visiblePeople = (store: StoreModel, projectId: string): VisiblePeople => {
  const users = recordsIn(store, "users");
  const userIds = countsOf(users, (row) => typeof row._id === "string" ? row._id : undefined);
  const currentUsers = users.flatMap((row) =>
    typeof row._id === "string" && userIds.get(row._id) === 1 && isStoredUser(row)
      ? [row]
      : []
  );
  const currentUserIds = new Set(currentUsers.map((row) => row._id as string));

  const memberships = recordsIn(store, "memberships");
  const membershipIds = countsOf(
    memberships,
    (row) => typeof row._id === "string" ? row._id : undefined
  );
  const projectUserClaims = countsOf(
    memberships,
    (row) => row.projectId === projectId && typeof row.userId === "string"
      ? row.userId
      : undefined
  );
  const visibleIds = new Set(
    memberships.flatMap((row) =>
      typeof row._id === "string" &&
      membershipIds.get(row._id) === 1 &&
      isStoredMembership(row) &&
      row.projectId === projectId &&
      projectUserClaims.get(row.userId) === 1 &&
      currentUserIds.has(row.userId)
        ? [row.userId as string]
        : []
    )
  );
  return {
    userIds: visibleIds,
    people: currentUsers.flatMap((row) =>
      visibleIds.has(row._id)
        ? [{ _id: row._id as string, displayName: row.displayName }]
        : []
    )
  };
};
