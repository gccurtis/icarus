import type { StoreModel } from "$model/server/store/index.server";
import { projectResourceText } from "$representation/data/behavior/semantic/resource-text";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { SemanticResourceProjection } from "$representation/data/types/semantic/source";
import { normalizeSlideDeckBody } from "$representation/data/behavior/slide-decks/normalize";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";

/** Reads a project-owned resource and produces the only text shape translation accepts. */
export const readSemanticResourceFor = (
  store: StoreModel,
  projectId: Id<"projects">,
  ref: ResourceRef
): SemanticResourceProjection | undefined => {
  if (ref.kind === "document") {
    const resource = rowsOf(store, "documents").find(
      (row) => row.projectId === projectId && row._id === ref.id
    );
    if (resource === undefined) return undefined;
    const leader = rowsOf(store, "documentSnapshots").find(
      (row) =>
        row.projectId === projectId &&
        row.resourceId === resource._id &&
        row.role === "leader"
    );
    if (leader === undefined) throw new Error(`Document '${ref.id}' has no leader snapshot`);
    return projectResourceText({
      kind: "document",
      ref,
      revision: leader.revision,
      title: resource.title,
      body: leader.body
    });
  }

  if (ref.kind === "slides") {
    const resource = rowsOf(store, "slideDecks").find(
      (row) => row.projectId === projectId && row._id === ref.id
    );
    if (resource === undefined) return undefined;
    const leader = rowsOf(store, "slideDeckSnapshots").find(
      (row) =>
        row.projectId === projectId &&
        row.resourceId === resource._id &&
        row.role === "leader"
    );
    if (leader === undefined) throw new Error(`Slide deck '${ref.id}' has no leader snapshot`);
    return projectResourceText({
      kind: "slides",
      ref,
      revision: leader.revision,
      title: resource.title,
      body: normalizeSlideDeckBody(leader.body)
    });
  }

  throw new Error(`Semantic projection does not support resource kind '${ref.kind}'`);
};
