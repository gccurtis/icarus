import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import {
  activityIn,
  isUserActor
} from "$capabilities/project/api/shared/projection";
import {
  boundedText,
  finiteTime,
  recordsIn
} from "$capabilities/project/api/shared/store";
import { validateReadProjectPerson } from "$capabilities/project/api/read-project-person/validate-read-project-person";
import type { ReadProjectPersonResult } from "$capabilities/project/types/project";

const RESOURCE_TABLES = [
  "documents",
  "slideDecks",
  "spreadsheets",
  "researchThreads",
  "findings"
] as const;

/** One project member, with policy-safe identity and bounded contribution facts. */
export const readProjectPerson = async (input: unknown): Promise<ReadProjectPersonResult> => {
  const scope = await requireScope();
  const asked = validateReadProjectPerson(input);

  const store = serverModel().store;
  const membership = recordsIn(store, "memberships").find(
    (row) => row.projectId === scope.projectId && row.userId === asked.userId
  );
  if (membership === undefined) return null;

  const user = recordsIn(store, "users").find((row) => row._id === asked.userId);
  const name = boundedText(user?.displayName, 160);
  const role = boundedText(membership.role, 80);
  const joinedAt = finiteTime(membership._creationTime);
  if (user === undefined || name === undefined || role === undefined || joinedAt === undefined) {
    return null;
  }

  const recentActivity = activityIn(store, scope).filter((entry) => {
    const row = recordsIn(store, "activity").find((candidate) => candidate._id === entry.id);
    return isUserActor(row?.actor, asked.userId);
  });
  const comments = recordsIn(store, "comments").filter(
    (row) => row.projectId === scope.projectId && isUserActor(row.author, asked.userId)
  ).length;
  const resources = RESOURCE_TABLES.reduce(
    (count, table) =>
      count +
      recordsIn(store, table).filter(
        (row) => row.projectId === scope.projectId && isUserActor(row.createdBy, asked.userId)
      ).length,
    0
  );
  const email = boundedText(user.email, 320);
  const imageUrl = boundedText(user.imageUrl, 2_000);

  return {
    id: asked.userId,
    name,
    ...(email === undefined ? {} : { email }),
    ...(imageUrl === undefined ? {} : { imageUrl }),
    role,
    joinedAt,
    contribution: {
      events: recentActivity.length,
      comments,
      resources
    },
    recentActivity: recentActivity.slice(0, 5)
  };
};
