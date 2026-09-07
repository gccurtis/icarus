import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";

import { paragraphOf } from "$capabilities/comments/api/shared/paragraph";
import { validateStartThread } from "$capabilities/comments/api/start-thread/validate-start-thread";
import type { StartThreadResult } from "$capabilities/comments/types/start-thread";

export const startThread = async (input: unknown): Promise<StartThreadResult> => {
  const scope = await requireScope();
  const asked = validateStartThread(input);

  const store = serverModel().store;
  const stages = store.read("templateStages");
  if (
    stages?.table === "templateStages" &&
    stages.kind === "table" &&
    stages.rows.some((row) => row.projectId === scope.projectId && row.resourceId === asked.target.id)
  ) {
    throw new Error("comments/start-thread: a template's working copy takes no comments");
  }
  const projectId = asId<"projects">(scope.projectId);
  const author = { kind: "user" as const, userId: asId<"users">(scope.userId) };
  const at = Date.now();

  const threadId = store.create("commentThreads", {
    projectId,
    target: asked.target,
    ...(asked.within === undefined ? {} : { within: asked.within }),
    ...(asked.quote === undefined ? {} : { quote: asked.quote }),
    createdBy: author,
    updatedAt: at
  });

  const commentId = store.create("comments", {
    projectId,
    threadId,
    blocks: [paragraphOf(asked.text)],
    mentions: [],
    author
  });

  return { threadId, commentId };
};
