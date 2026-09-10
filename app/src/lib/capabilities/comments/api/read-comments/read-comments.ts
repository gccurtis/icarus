import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { storedFields } from "$representation/data/behavior/core/stored";
import { visiblePeople } from "$capabilities/comments/api/read-comments/people";
import {
  projectRemark,
  projectThread
} from "$capabilities/comments/api/read-comments/projection";
import type {
  CommentRemarkRecord,
  CommentThreadRecord,
  ReadCommentsResult
} from "$capabilities/comments/types/read-comments";

const rowsIn = (
  table: string,
  value: ReturnType<ReturnType<typeof serverModel>["store"]["read"]>
): readonly unknown[] => value?.kind === "table" && value.table === table ? value.rows : [];

const identityCounts = (rows: readonly unknown[]): ReadonlyMap<string, number> => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const id = storedFields(row)?._id;
    if (typeof id === "string") counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
};

export const readComments = async (): Promise<ReadCommentsResult> => {
  const scope = await requireScope();
  const store = serverModel().store;
  const visible = visiblePeople(store, scope.projectId);

  const storedStages = rowsIn("templateStages", store.read("templateStages"));
  const stagedResourceIds = new Set(
    storedStages.flatMap((row) => {
      const resourceId = storedFields(row)?.resourceId;
      return typeof resourceId === "string" ? [resourceId] : [];
    })
  );

  const storedThreads = rowsIn("commentThreads", store.read("commentThreads"));
  const threadIdCounts = identityCounts(storedThreads);
  const candidateThreads = storedThreads.flatMap((row) => {
    const id = storedFields(row)?._id;
    if (typeof id !== "string" || threadIdCounts.get(id) !== 1) return [];
    const projected = projectThread(
      store,
      scope.projectId,
      visible.userIds,
      stagedResourceIds,
      row
    );
    return projected === undefined ? [] : [projected];
  });
  const candidateThreadIds = new Set(candidateThreads.map((thread) => thread._id));

  const storedRemarks = rowsIn("comments", store.read("comments"));
  const remarkIdCounts = identityCounts(storedRemarks);
  const threads: CommentThreadRecord[] = [];
  const remarks: CommentRemarkRecord[] = [];
  for (const thread of candidateThreads) {
    const claimed = storedRemarks.filter(
      (row) => storedFields(row)?.threadId === thread._id
    );
    const admitted = claimed.map((row) => {
      const id = storedFields(row)?._id;
      return typeof id === "string" && remarkIdCounts.get(id) === 1
        ? projectRemark(
            store,
            scope.projectId,
            candidateThreadIds,
            visible.userIds,
            row
          )
        : undefined;
    });
    if (admitted.length === 0 || admitted.some((remark) => remark === undefined)) continue;
    threads.push(thread);
    remarks.push(...admitted as CommentRemarkRecord[]);
  }

  return {
    viewerId: scope.userId,
    threads,
    remarks,
    people: visible.people
  };
};
