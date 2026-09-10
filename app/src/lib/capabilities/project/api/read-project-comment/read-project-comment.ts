import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { TableRow } from "$model/server/store/index.server";

import {
  isStoredComment,
  storedCommentText
} from "$representation/data/behavior/collaboration/stored-comments";
import type { AnchorWithin } from "$representation/data/types/collaboration/anchor";

import { projectActor } from "$capabilities/project/api/shared/actors";
import { ownedProjectThread } from "$capabilities/project/api/shared/comment-ownership";
import { recordsIn, type StoreReads } from "$capabilities/project/api/shared/store";
import { validateReadProjectComment } from "$capabilities/project/api/read-project-comment/validate-read-project-comment";
import type {
  ProjectCommentAnchor,
  ProjectCommentRemark,
  ReadProjectCommentResult
} from "$capabilities/project/types/project";
import type { Scope } from "$runtime/server/scope.server";

const projectedAnchor = (within: AnchorWithin | undefined): ProjectCommentAnchor => {
  if (within === undefined) return null;
  if (within.kind === "text") {
    return { kind: "document-text", blockId: within.spans[0].blockId };
  }
  if (within.kind === "slide") return { kind: "slide", slideId: within.slideId };
  if (within.kind === "element") return { kind: "element", elementId: within.elementId };
  return { kind: "cell", rowId: within.rowId, columnId: within.columnId };
};

const projectedRemark = (
  store: StoreReads,
  scope: Scope,
  row: TableRow<"comments">
): ProjectCommentRemark => {
  const author = projectActor(store, scope, row.author);
  return {
    id: row._id,
    at: row._creationTime,
    author,
    ...(author === null ? {} : { authorLabel: author.label }),
    text: storedCommentText(row)
  };
};

/** One exact owned discussion; unavailable historical actors remain explicitly null. */
export const readProjectComment = async (input: unknown): Promise<ReadProjectCommentResult> => {
  const scope = await requireScope();
  const asked = validateReadProjectComment(input);
  const store = serverModel().store;
  const owned = ownedProjectThread(store, scope.projectId, asked.threadId);
  if (owned === undefined) return null;

  const rows = recordsIn(store, "comments");
  const idCounts = new Map<unknown, number>();
  for (const row of rows) idCounts.set(row._id, (idCounts.get(row._id) ?? 0) + 1);
  const claims = rows.filter((row) => row.threadId === asked.threadId);
  if (
    claims.length === 0 ||
    claims.some((row) =>
      idCounts.get(row._id) !== 1 ||
      !isStoredComment(row) ||
      row.projectId !== scope.projectId
    )
  ) return null;
  const remarks = (claims as TableRow<"comments">[])
    .map((row) => projectedRemark(store, scope, row))
    .sort((left, right) => left.at - right.at);

  const { row: thread, resource } = owned;
  const opening = remarks[0] ?? null;
  return {
    id: thread._id,
    state: thread.resolution === undefined ? "open" : "resolved",
    target: {
      id: resource.row._id,
      kind: resource.spec.kind,
      name: resource.row.title
    },
    anchor: projectedAnchor(thread.within),
    ...(thread.quote === undefined ? {} : { selectedText: thread.quote }),
    selectedBy: projectActor(store, scope, thread.createdBy),
    selectedAt: thread._creationTime,
    opening,
    replies: opening === null ? [] : remarks.slice(1)
  };
};
