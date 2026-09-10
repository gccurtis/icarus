import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import {
  enqueueSemanticSync,
  processSemanticSyncQueueFor,
  semanticSourceIsCurrent
} from "$capabilities/semantic-overlay";

import { rowsIn } from "$capabilities/research-chat/api/shared/store";

const RESOURCE_TABLES = [
  ["document", "documents"],
  ["slides", "slideDecks"]
] as const;

const refsIn = (model: ServerModel, projectId: Id<"projects">): ResourceRef[] =>
  RESOURCE_TABLES.flatMap(([kind, table]) =>
    rowsIn(model.store, table)
      .filter((row) => row.projectId === projectId)
      .map((row) => ({ kind, id: row._id as string }))
  );

const alreadyIndexed = (model: ServerModel, projectId: Id<"projects">, ref: ResourceRef): boolean =>
  rowsIn(model.store, "semanticSources").some(
    (source) =>
      source.projectId === projectId &&
      source.ref.kind === ref.kind &&
      source.ref.id === ref.id &&
      semanticSourceIsCurrent(model.store, projectId, source)
  );

/**
 * Bring the project's overlay up to date before a question is asked of it.
 *
 * A chat is a pull boundary in the same sense a derived output is: nothing else
 * guarantees the overlay is current at the moment somebody asks, so the turn
 * pays for it. Resources already indexed at their current revision are skipped,
 * which makes the second question in a conversation cost nothing here.
 */
export const prepareOverlay = async (
  model: ServerModel,
  projectId: Id<"projects">
): Promise<{ indexed: number }> => {
  let indexed = 0;
  for (const ref of refsIn(model, projectId)) {
    if (alreadyIndexed(model, projectId, ref)) continue;
    await enqueueSemanticSync({ ref });
    indexed += 1;
  }

  for (let batch = 0; batch < 20; batch += 1) {
    const processed = await processSemanticSyncQueueFor(model, projectId, 25);
    const failed = processed.failed[0] ?? processed.materials.failed[0];
    if (failed?.error !== undefined) throw new Error(failed.error);
    if (processed.remaining === 0 && processed.materials.remaining === 0) return { indexed };
  }
  throw new Error("The project's semantic overlay did not settle before the question ran");
};
