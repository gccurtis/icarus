import { requireScope, type Scope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { TableName } from "$model/server/store/index.server";

import { storedProjectResource } from "$representation/data/behavior/project-resources/stored";
import {
  isStoredMembership,
  isStoredUser,
  storedMembershipRole
} from "$representation/data/behavior/core/stored-project";

import { claimsProjectUserActor } from "$capabilities/project/api/shared/actors";
import { projectCommentCountByUser } from "$capabilities/project/api/shared/comment-ownership";
import { activityOf } from "$capabilities/project/api/shared/projection";
import { recordsIn, type StoreReads } from "$capabilities/project/api/shared/store";
import { validateReadProjectPerson } from "$capabilities/project/api/read-project-person/validate-read-project-person";
import type {
  ProjectActivityEntry,
  ReadProjectPersonResult
} from "$capabilities/project/types/project";

const RESOURCE_TABLES = [
  "documents",
  "presentations",
  "spreadsheets",
  "researchThreads",
  "findings"
] as const satisfies readonly TableName[];

const activityByUser = (
  store: StoreReads,
  scope: Scope,
  userId: string
): readonly ProjectActivityEntry[] | undefined => {
  const rows = recordsIn(store, "activity");
  const idCounts = new Map<unknown, number>();
  for (const row of rows) idCounts.set(row._id, (idCounts.get(row._id) ?? 0) + 1);
  const candidates = rows.filter(
    (row) => row.projectId === scope.projectId && claimsProjectUserActor(row.actor, userId)
  );
  const admitted = candidates.map((row) => activityOf(store, scope, row));
  if (
    candidates.some((row) => idCounts.get(row._id) !== 1) ||
    admitted.some((entry) => entry === undefined)
  ) return undefined;
  return (admitted as ProjectActivityEntry[]).sort((left, right) => right.at - left.at);
};

const resourcesByUser = (
  store: StoreReads,
  projectId: string,
  userId: string
): number | undefined => {
  let count = 0;
  for (const table of RESOURCE_TABLES) {
    const rows = recordsIn(store, table);
    const idCounts = new Map<unknown, number>();
    for (const row of rows) idCounts.set(row._id, (idCounts.get(row._id) ?? 0) + 1);
    const candidates = rows.filter(
      (row) => row.projectId === projectId && claimsProjectUserActor(row.createdBy, userId)
    );
    if (
      candidates.some((row) => idCounts.get(row._id) !== 1) ||
      candidates.some((row) => storedProjectResource(row, table) === undefined)
    ) return undefined;
    count += candidates.length;
  }
  return count;
};

/** One exact project member, with exact current contribution subjects only. */
export const readProjectPerson = async (input: unknown): Promise<ReadProjectPersonResult> => {
  const scope = await requireScope();
  const asked = validateReadProjectPerson(input);
  const store = serverModel().store;

  const allMemberships = recordsIn(store, "memberships");
  const membershipClaims = allMemberships.filter(
    (row) => row.projectId === scope.projectId && row.userId === asked.userId
  );
  const userClaims = recordsIn(store, "users").filter((row) => row._id === asked.userId);
  if (
    membershipClaims.length !== 1 ||
    allMemberships.filter((row) => row._id === membershipClaims[0]?._id).length !== 1 ||
    !isStoredMembership(membershipClaims[0]) ||
    userClaims.length !== 1 ||
    !isStoredUser(userClaims[0])
  ) return null;

  const membership = membershipClaims[0];
  const user = userClaims[0];
  const recentActivity = activityByUser(store, scope, asked.userId);
  const comments = projectCommentCountByUser(store, scope.projectId, asked.userId);
  const resources = resourcesByUser(store, scope.projectId, asked.userId);
  const role = storedMembershipRole(membership.role);
  if (
    recentActivity === undefined ||
    comments === undefined ||
    resources === undefined ||
    role === undefined
  ) return null;

  return {
    id: asked.userId,
    name: user.displayName,
    ...(user.email === undefined ? {} : { email: user.email }),
    ...(user.imageUrl === undefined ? {} : { imageUrl: user.imageUrl }),
    role,
    joinedAt: membership._creationTime,
    contribution: {
      events: recentActivity.length,
      comments,
      resources
    },
    recentActivity: recentActivity.slice(0, 5)
  };
};
