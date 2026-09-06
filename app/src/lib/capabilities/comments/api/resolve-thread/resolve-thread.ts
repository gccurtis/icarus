import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";

import { threadOf } from "$capabilities/comments/api/shared/thread";
import { validateResolveThread } from "$capabilities/comments/api/resolve-thread/validate-resolve-thread";
import type { ResolveThreadResult } from "$capabilities/comments/types/resolve-thread";

export const resolveThread = async (input: unknown): Promise<ResolveThreadResult> => {
  const scope = await requireScope();
  const asked = validateResolveThread(input);

  const store = serverModel().store;
  const thread = threadOf(store, scope.projectId, asked.threadId);
  if (thread === undefined) throw new Error(`comments/resolve-thread: no thread ${asked.threadId}`);

  const at = Date.now();
  if (asked.resolved) {
    store.update(`commentThreads.${thread._id}.resolution`, { by: asId<"users">(scope.userId), at });
  } else if (thread.resolution !== undefined) {
    store.remove(`commentThreads.${thread._id}.resolution`);
  }
  store.update(`commentThreads.${thread._id}.updatedAt`, at);

  return { resolved: asked.resolved };
};
