import type { StoreUnitOfWork } from "$model/server/store/index.server";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";

import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";

/**
 * A template's working copy is a draft of a template, not the project's material.
 *
 * The copy is an ordinary document or deck, so every ordinary path would ingest
 * it: saving enqueues, and a backfill sweeps every leader revision. Indexing one
 * would put unfinished — and, once discarded, deliberately abandoned — words in
 * front of every agent that retrieves, which is why the answer is no wherever
 * the question is asked.
 */
export const isStagedResource = (
  store: StoreUnitOfWork,
  projectId: Id<"projects">,
  ref: ResourceRef
): boolean =>
  (ref.kind === "document" || ref.kind === "slides") &&
  rowsOf(store, "templateStages").some(
    (row) => row.projectId === projectId && row.resourceId === ref.id
  );
