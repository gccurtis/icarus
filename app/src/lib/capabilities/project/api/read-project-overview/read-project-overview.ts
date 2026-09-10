import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import {
  isStoredMembership,
  isStoredProject,
  isStoredUser,
  storedMembershipRole
} from "$representation/data/behavior/core/stored-project";

import { recordsIn } from "$capabilities/project/api/shared/store";
import type { ReadProjectOverviewResult } from "$capabilities/project/types/project";

/** Stable project metadata admitted only from complete current ownership rows. */
export const readProjectOverview = async (): Promise<ReadProjectOverviewResult> => {
  const scope = await requireScope();
  const store = serverModel().store;
  const projectClaims = recordsIn(store, "projects").filter((row) => row._id === scope.projectId);
  const allMemberships = recordsIn(store, "memberships");
  const membershipIdCounts = new Map<unknown, number>();
  for (const row of allMemberships) {
    membershipIdCounts.set(row._id, (membershipIdCounts.get(row._id) ?? 0) + 1);
  }
  const membershipClaims = allMemberships.filter(
    (row) => row.projectId === scope.projectId
  );
  if (
    projectClaims.length !== 1 ||
    !isStoredProject(projectClaims[0]) ||
    membershipClaims.some((row) => !isStoredMembership(row)) ||
    membershipClaims.some((row) => membershipIdCounts.get(row._id) !== 1) ||
    new Set(membershipClaims.map((row) => row.userId)).size !== membershipClaims.length
  ) return null;

  const viewerClaims = membershipClaims.filter((row) => row.userId === scope.userId);
  if (viewerClaims.length !== 1) return null;
  const viewerRole = storedMembershipRole(viewerClaims[0].role);
  if (viewerRole === undefined) return null;

  const people = [];
  for (const membership of membershipClaims) {
    const users = recordsIn(store, "users").filter((row) => row._id === membership.userId);
    const role = storedMembershipRole(membership.role);
    if (users.length !== 1 || !isStoredUser(users[0]) || role === undefined) return null;
    people.push({
      id: users[0]._id,
      name: users[0].displayName,
      role
    });
  }

  const project = projectClaims[0];
  return {
    projectId: scope.projectId,
    viewerId: scope.userId,
    name: project.name,
    description: project.description ?? "",
    status: project.archivedAt === undefined ? "active" : "archived",
    viewerRole,
    createdAt: project._creationTime,
    people
  };
};
