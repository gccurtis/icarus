import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import { readSemanticResourceFor } from "$capabilities/semantic-overlay/api/shared/resource";
import { enqueueSemanticSyncFor } from "$capabilities/semantic-overlay/api/shared/sync-queue";
import { validateEnqueueSemanticSync } from "$capabilities/semantic-overlay/api/enqueue-semantic-sync/validate-enqueue-semantic-sync";
import type { EnqueueSemanticSyncResult } from "$capabilities/semantic-overlay/types/enqueue-semantic-sync";

/** Captures the authoritative leader revision; callers provide only a scoped resource ref. */
export const enqueueSemanticSync = async (
  input: unknown
): Promise<EnqueueSemanticSyncResult> => {
  const scope = await requireScope();
  const asked = validateEnqueueSemanticSync(input);
  const model = serverModel();
  const projectId = scope.projectId as Id<"projects">;
  const resource = readSemanticResourceFor(model.store, projectId, asked.ref);
  if (resource === undefined) return null;
  return {
    jobId: enqueueSemanticSyncFor(model, projectId, asked.ref, resource.revision),
    ref: asked.ref,
    revision: resource.revision
  };
};
