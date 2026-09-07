import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import { processSemanticSyncQueueFor } from "$capabilities/semantic-overlay/api/shared/queue-processor";
import { validateProcessSemanticSyncQueue } from "$capabilities/semantic-overlay/api/process-semantic-sync-queue/validate-process-semantic-sync-queue";
import type { ProcessSemanticSyncQueueResult } from "$capabilities/semantic-overlay/types/semantic-sync-queue";

export const processSemanticSyncQueue = async (
  input: unknown
): Promise<ProcessSemanticSyncQueueResult> => {
  const scope = await requireScope();
  const asked = validateProcessSemanticSyncQueue(input);
  return processSemanticSyncQueueFor(
    serverModel(),
    scope.projectId as Id<"projects">,
    asked.limit,
    asked.ref
  );
};
