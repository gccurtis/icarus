import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import { syncSemanticResourceFor } from "$capabilities/semantic-overlay/api/shared/sync";
import { validateSyncSemanticResource } from "$capabilities/semantic-overlay/api/sync-semantic-resource/validate-sync-semantic-resource";
import type { SyncSemanticResourceResult } from "$capabilities/semantic-overlay/types/sync-semantic-resource";

/** Translates the latest authoritative revision and publishes it if still current. */
export const syncSemanticResource = async (
  input: unknown
): Promise<SyncSemanticResourceResult> => {
  const scope = await requireScope();
  const asked = validateSyncSemanticResource(input);
  return syncSemanticResourceFor(
    serverModel(),
    scope.projectId as Id<"projects">,
    asked.ref,
    asked.force ?? false
  );
};
