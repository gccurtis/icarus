import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import { validateEnqueueSemanticSync } from "$capabilities/semantic-overlay/api/enqueue-semantic-sync/validate-enqueue-semantic-sync";
import type { EnqueueSemanticSyncResult } from "$capabilities/semantic-overlay/types/enqueue-semantic-sync";
import { enqueueSemanticSyncForModel } from "$capabilities/semantic-overlay/api/shared/enqueue-for-model";

/** Captures the authoritative leader revision; callers provide only a scoped resource ref. */
export const enqueueSemanticSync = async (
  input: unknown,
  signal?: AbortSignal
): Promise<EnqueueSemanticSyncResult> => {
  const scope = await requireScope();
  const asked = validateEnqueueSemanticSync(input);
  const model = serverModel();
  const projectId = scope.projectId as Id<"projects">;
  return enqueueSemanticSyncForModel(model, projectId, asked.ref, signal);
};
