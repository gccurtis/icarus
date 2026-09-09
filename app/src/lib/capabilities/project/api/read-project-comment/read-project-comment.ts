import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { actorOf } from "$capabilities/project/api/shared/projection";
import { projectResourceOf } from "$capabilities/project/api/shared/resources";
import {
  boundedText,
  finiteTime,
  recordOf,
  recordsIn,
  type StoreReads
} from "$capabilities/project/api/shared/store";
import { validateReadProjectComment } from "$capabilities/project/api/read-project-comment/validate-read-project-comment";
import type {
  ProjectCommentAnchor,
  ProjectCommentRemark,
  ReadProjectCommentResult
} from "$capabilities/project/types/project";
import type { Scope } from "$runtime/server/scope.server";

const idOf = (value: unknown): string | undefined => boundedText(value, 500);

const textOf = (value: unknown): string => {
  const row = recordOf(value);
  if (!Array.isArray(row?.blocks)) return "";
  return row.blocks
    .flatMap((block) => {
      const display = recordOf(block)?.display;
      return typeof display === "string" && display.length <= 20_000 ? [display] : [];
    })
    .join("\n")
    .slice(0, 20_000);
};

const remarkOf = (
  store: StoreReads,
  scope: Scope,
  value: unknown
): ProjectCommentRemark | undefined => {
  const row = recordOf(value);
  const id = idOf(row?._id);
  const at = finiteTime(row?._creationTime);
  if (row?.projectId !== scope.projectId || id === undefined || at === undefined) {
    return undefined;
  }
  const author = actorOf(store, scope, row.author);
  return {
    id,
    at,
    author,
    authorLabel: author?.label ?? "Someone",
    text: textOf(row)
  };
};

const anchorOf = (value: unknown): ProjectCommentAnchor => {
  const within = recordOf(value);
  if (within?.kind === "text") {
    const first = Array.isArray(within.spans) ? recordOf(within.spans[0]) : undefined;
    const blockId = idOf(first?.blockId);
    return blockId === undefined ? null : { kind: "document-text", blockId };
  }
  if (within?.kind === "slide") {
    const slideId = idOf(within.slideId);
    return slideId === undefined ? null : { kind: "slide", slideId };
  }
  if (within?.kind === "element") {
    const elementId = idOf(within.elementId);
    return elementId === undefined ? null : { kind: "element", elementId };
  }
  return null;
};

/** The Project Overview discussion lens, projected without widening generic store reads. */
export const readProjectComment = async (input: unknown): Promise<ReadProjectCommentResult> => {
  const scope = await requireScope();
  const asked = validateReadProjectComment(input);
  const store = serverModel().store;
  const threads = recordsIn(store, "commentThreads").filter(
    (row) => row._id === asked.threadId && row.projectId === scope.projectId
  );
  if (threads.length !== 1) return null;
  const thread = threads[0];
  const targetRef = recordOf(thread.target);
  const targetId = idOf(targetRef?.id);
  if (targetId === undefined) return null;
  const target = projectResourceOf(store, scope.projectId, targetId);
  const name = boundedText(target?.row.title, 10_000);
  const threadAt = finiteTime(thread._creationTime);
  if (target === undefined || name === undefined || threadAt === undefined) return null;

  const remarks = recordsIn(store, "comments")
    .filter((row) => row.threadId === asked.threadId && row.projectId === scope.projectId)
    .flatMap((row) => {
      const remark = remarkOf(store, scope, row);
      return remark === undefined ? [] : [remark];
    })
    .sort((left, right) => left.at - right.at);

  const opening = remarks[0] ?? null;
  return {
    id: asked.threadId,
    state: thread.resolution === undefined ? "open" : "resolved",
    target: { id: targetId, kind: target.spec.kind, name },
    anchor: anchorOf(thread.within),
    ...(boundedText(thread.quote, 20_000) === undefined
      ? {}
      : { selectedText: boundedText(thread.quote, 20_000) }),
    selectedBy: actorOf(store, scope, thread.createdBy),
    selectedAt: threadAt,
    opening,
    replies: opening === null ? [] : remarks.slice(1)
  };
};
