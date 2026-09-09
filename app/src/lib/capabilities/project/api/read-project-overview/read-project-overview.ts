import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import {
  boundedText,
  finiteTime,
  recordsIn
} from "$capabilities/project/api/shared/store";
import type { ReadProjectOverviewResult } from "$capabilities/project/types/project";

/** Stable project metadata that is not already repeated on the overview canvas. */
export const readProjectOverview = async (): Promise<ReadProjectOverviewResult> => {
  const scope = await requireScope();

  const store = serverModel().store;
  const project = recordsIn(store, "projects").find((row) => row._id === scope.projectId);
  const membership = recordsIn(store, "memberships").find(
    (row) => row.projectId === scope.projectId && row.userId === scope.userId
  );
  const createdAt = finiteTime(project?._creationTime);
  const viewerRole = boundedText(membership?.role, 80);
  if (project === undefined || createdAt === undefined || viewerRole === undefined) return null;

  return {
    projectId: scope.projectId,
    status: finiteTime(project.archivedAt) === undefined ? "active" : "archived",
    viewerRole,
    createdAt
  };
};
