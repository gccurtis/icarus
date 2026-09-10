import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
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
import { rowsIn } from "$capabilities/comments/api/read-comments/store";

export const readComments = async (): Promise<ReadCommentsResult> => {
  const scope = await requireScope();
  const store = serverModel().store;
  const visible = visiblePeople(store, scope.projectId);

  const storedStages = rowsIn(store, "templateStages");
  const stagedResourceIds = new Set(storedStages.map((row) => row.resourceId));

  const storedThreads = rowsIn(store, "commentThreads");
  const candidateThreads = storedThreads.flatMap((row) => {
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

  const storedRemarks = rowsIn(store, "comments");
  const threads: CommentThreadRecord[] = [];
  const remarks: CommentRemarkRecord[] = [];
  for (const thread of candidateThreads) {
    const claimed = storedRemarks.filter(
      (row) => row.threadId === thread._id
    );
    const admitted = claimed.map((row) => projectRemark(
      store,
      scope.projectId,
      candidateThreadIds,
      visible.userIds,
      row
    ));
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
