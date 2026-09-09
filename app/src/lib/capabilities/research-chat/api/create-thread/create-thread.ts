import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";

import { validateCreateThread } from "$capabilities/research-chat/api/create-thread/validate-create-thread";
import { viewer } from "$capabilities/research-chat/api/shared/store";
import type { CreateThreadResult } from "$capabilities/research-chat/types/research-chat";

export const createThread = async (input: unknown): Promise<CreateThreadResult> => {
  const scope = await requireScope();
  const asked = validateCreateThread(input);
  const store = serverModel().store;
  const at = Date.now();
  const threadId = store.create("threads", {
    projectId: scope.projectId,
    kind: "researchThread"
  }) as Id<"threads">;
  store.create("threadParts", {
    projectId: scope.projectId,
    threadId,
    part: 1,
    messages: []
  });
  const researchThreadId = store.create("researchThreads", {
    projectId: scope.projectId,
    threadId,
    title: asked.title ?? "New chat",
    mode: { kind: "explore" },
    findingIds: [],
    createdBy: viewer(scope),
    updatedAt: at
  });
  return { threadId: researchThreadId };
};
