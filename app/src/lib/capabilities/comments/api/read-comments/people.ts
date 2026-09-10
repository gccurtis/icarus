import type { StoreModel } from "$model/server/store/index.server";
import {
  isStoredMembership,
  isStoredUser
} from "$representation/data/behavior/core/stored-project";
import type { CommentPersonRecord } from "$capabilities/comments/types/read-comments";
import { rowsIn } from "$capabilities/comments/api/read-comments/store";

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

export type VisiblePeople = {
  readonly userIds: ReadonlySet<string>;
  readonly people: readonly CommentPersonRecord[];
};

/** Exact users with exactly one exact membership in the active project. */
export const visiblePeople = (store: StoreModel, projectId: string): VisiblePeople => {
  const users = rowsIn(store, "users");
  if (!users.every(isStoredUser)) throw new Error("the users table contains a non-current row");
  const currentUserIds = new Set(users.map((row) => row._id));

  const memberships = rowsIn(store, "memberships");
  if (!memberships.every(isStoredMembership)) {
    throw new Error("the memberships table contains a non-current row");
  }
  const projectUserClaims = countsOf(
    memberships,
    (row) => row.projectId === projectId && typeof row.userId === "string"
      ? row.userId
      : undefined
  );
  const visibleIds = new Set(
    memberships.flatMap((row) =>
      typeof row._id === "string" &&
      row.projectId === projectId &&
      projectUserClaims.get(row.userId) === 1 &&
      currentUserIds.has(row.userId)
        ? [row.userId as string]
        : []
    )
  );
  return {
    userIds: visibleIds,
    people: users.flatMap((row) =>
      visibleIds.has(row._id)
        ? [{ _id: row._id as string, displayName: row.displayName }]
        : []
    )
  };
};
