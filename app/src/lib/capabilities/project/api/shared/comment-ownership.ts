import {
  isStoredComment,
  isStoredCommentThread,
  type StoredCommentTarget
} from "$representation/data/behavior/collaboration/stored-comments";
import type { TableRow } from "$model/server/store/index.server";

import { claimsProjectUserActor } from "$capabilities/project/api/shared/actors";
import {
  projectResourceOf,
  type RepresentedProjectResource
} from "$capabilities/project/api/shared/resources";
import { recordOf, recordsIn, type StoreReads } from "$capabilities/project/api/shared/store";

const targetKindFor = (
  resource: RepresentedProjectResource
): StoredCommentTarget["kind"] | undefined => {
  if (resource.spec.kind === "document") return "document";
  if (resource.spec.kind === "presentation") return "presentation";
  if (resource.spec.kind === "spreadsheet") return "spreadsheet";
  return undefined;
};

export type OwnedProjectThread = {
  readonly row: TableRow<"commentThreads">;
  readonly resource: RepresentedProjectResource;
};

/** Exactly one current thread, owned by its exact current project resource. */
export const ownedProjectThread = (
  store: StoreReads,
  projectId: string,
  threadId: string
): OwnedProjectThread | undefined => {
  const claimed = recordsIn(store, "commentThreads").filter((row) => row._id === threadId);
  if (claimed.length !== 1 || !isStoredCommentThread(claimed[0])) return undefined;
  const row = claimed[0];
  if (row.projectId !== projectId) return undefined;
  const resource = projectResourceOf(store, projectId, row.target.id);
  return resource !== undefined && targetKindFor(resource) === row.target.kind
    ? { row, resource }
    : undefined;
};

/** Exact same-project threads for one resource, or unavailable on a malformed claimant. */
export const projectThreadCount = (
  store: StoreReads,
  projectId: string,
  resource: RepresentedProjectResource
): number | undefined => {
  const rows = recordsIn(store, "commentThreads");
  const idCounts = new Map<unknown, number>();
  for (const row of rows) idCounts.set(row._id, (idCounts.get(row._id) ?? 0) + 1);
  const candidates = rows.filter((row) => {
    const target = recordOf(row.target);
    return row.projectId === projectId && target?.id === resource.row._id;
  });
  const expectedKind = targetKindFor(resource);
  if (expectedKind === undefined) return candidates.length === 0 ? 0 : undefined;
  if (
    candidates.some(
      (row) =>
        idCounts.get(row._id) !== 1 ||
        !isStoredCommentThread(row) ||
        row.target.kind !== expectedKind
    )
  ) return undefined;
  return candidates.length;
};

/** Exact current comments authored by one member and attached to owned threads. */
export const projectCommentCountByUser = (
  store: StoreReads,
  projectId: string,
  userId: string
): number | undefined => {
  const rows = recordsIn(store, "comments");
  const idCounts = new Map<unknown, number>();
  for (const row of rows) idCounts.set(row._id, (idCounts.get(row._id) ?? 0) + 1);
  const candidates = rows.filter(
    (row) => row.projectId === projectId && claimsProjectUserActor(row.author, userId)
  );
  if (
    candidates.some((row) =>
      idCounts.get(row._id) !== 1 ||
      !isStoredComment(row) ||
      ownedProjectThread(store, projectId, row.threadId) === undefined
    )
  ) return undefined;
  return candidates.length;
};
