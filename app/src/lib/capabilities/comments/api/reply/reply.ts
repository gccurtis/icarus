import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";

import { paragraphOf } from "$capabilities/comments/api/shared/paragraph";
import { threadOf } from "$capabilities/comments/api/shared/thread";
import { validateReply } from "$capabilities/comments/api/reply/validate-reply";
import type { ReplyResult } from "$capabilities/comments/types/reply";

export const reply = async (input: unknown): Promise<ReplyResult> => {
  const scope = await requireScope();
  const asked = validateReply(input);

  const store = serverModel().store;
  const thread = threadOf(store, scope.projectId, asked.threadId);
  if (thread === undefined) throw new Error(`comments/reply: no thread ${asked.threadId}`);

  const at = Date.now();
  const commentId = store.create("comments", {
    projectId: thread.projectId,
    threadId: thread._id,
    blocks: [paragraphOf(asked.text)],
    mentions: [],
    author: { kind: "user" as const, userId: asId<"users">(scope.userId) }
  });
  store.update(`commentThreads.${thread._id}.updatedAt`, at);

  return { commentId };
};
