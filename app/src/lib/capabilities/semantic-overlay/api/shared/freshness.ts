import type { StoreUnitOfWork, TableRow } from "$model/server/store/index.server";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type {
  MaterialSource,
  SemanticMaterialPlacementFields
} from "$representation/data/types/semantic/material";
import type { SemanticSourceSnapshot } from "$representation/data/types/semantic/source";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";

/** The authoritative revision behind one editable resource, without reading its body. */
export const currentResourceRevisionFor = (
  store: StoreUnitOfWork,
  projectId: Id<"projects">,
  ref: ResourceRef
): number | undefined => {
  if (ref.kind === "document") {
    const exists = rowsOf(store, "documents").some(
      (row) => row.projectId === projectId && row._id === ref.id
    );
    return exists
      ? rowsOf(store, "documentSnapshots").find(
          (row) => row.projectId === projectId && row.resourceId === ref.id && row.role === "leader"
        )?.revision
      : undefined;
  }
  if (ref.kind === "slides") {
    const exists = rowsOf(store, "slideDecks").some(
      (row) => row.projectId === projectId && row._id === ref.id
    );
    return exists
      ? rowsOf(store, "slideDeckSnapshots").find(
          (row) => row.projectId === projectId && row.resourceId === ref.id && row.role === "leader"
        )?.revision
      : undefined;
  }
  if (ref.kind === "spreadsheet") {
    const exists = rowsOf(store, "spreadsheets").some(
      (row) => row.projectId === projectId && row._id === ref.id
    );
    return exists
      ? rowsOf(store, "spreadsheetSnapshots").find(
          (row) => row.projectId === projectId && row.resourceId === ref.id && row.role === "leader"
        )?.revision
      : undefined;
  }
  return undefined;
};

/** Whether an exact-lane source still points at its authoritative revision/hash. */
export const semanticSourceIsCurrent = (
  store: StoreUnitOfWork,
  projectId: Id<"projects">,
  source: Pick<SemanticSourceSnapshot, "ref" | "revision" | "contentHash">
): boolean => {
  if (source.ref.kind === "document" || source.ref.kind === "slides") {
    return currentResourceRevisionFor(store, projectId, source.ref) === source.revision;
  }
  if (source.ref.kind === "externalFile::text") {
    const file = rowsOf(store, "externalFiles").find(
      (row) => row.projectId === projectId && row._id === source.ref.id
    );
    if (file === undefined) return false;
    const subkind = file.subkind;
    return subkind === "text" && source.revision === 0 && source.contentHash === file.hash;
  }
  return true;
};

/** Whether a persisted material still points at the current native authority. */
export const materialSourceIsCurrent = (
  store: StoreUnitOfWork,
  projectId: Id<"projects">,
  source: MaterialSource
): boolean => {
  if (source.kind === "resourceContent") {
    return currentResourceRevisionFor(store, projectId, source.ref) === source.revision;
  }
  const externalSource = source;
  const file = rowsOf(store, "externalFiles").find(
    (row) => row.projectId === projectId && row._id === externalSource.fileId
  );
  if (file === undefined) return false;
  const subkind = file.subkind;
  return (
    externalSource.ref.id === file._id &&
    externalSource.ref.kind === `externalFile::${subkind}` &&
    externalSource.hash === file.hash &&
    externalSource.mediaType === file.mediaType &&
    externalSource.subkind === subkind
  );
};

export const materialPlacementIsCurrent = (
  store: StoreUnitOfWork,
  projectId: Id<"projects">,
  placement: Pick<SemanticMaterialPlacementFields, "ref" | "revision">
): boolean => currentResourceRevisionFor(store, projectId, placement.ref) === placement.revision;

/** Conservative pull-time gate: stale source or placement metadata is never searchable/readable. */
export const materialRecordIsCurrent = (
  store: StoreUnitOfWork,
  projectId: Id<"projects">,
  material: TableRow<"semanticMaterials">,
  placements: readonly TableRow<"semanticMaterialPlacements">[]
): boolean => {
  if (!materialSourceIsCurrent(store, projectId, material.source)) return false;
  const expectedRevisionKey = material.source.kind === "externalFile"
    ? `hash:${material.source.hash}`
    : `revision:${material.source.ref.kind}:${material.source.ref.id}:${material.source.revision}`;
  if (material.revisionKey !== expectedRevisionKey) return false;
  const own = placements.filter((placement) => placement.semanticMaterialId === material._id);
  if (own.some((placement) => !materialPlacementIsCurrent(store, projectId, placement))) return false;
  if (material.source.kind === "externalFile") {
    const externalSource = material.source;
    const file = rowsOf(store, "externalFiles").find(
      (row) => row.projectId === projectId && row._id === externalSource.fileId
    );
    if (file === undefined || file.name !== material.name) return false;
  }
  return material.profile.kind !== "image" || material.profile.placementCount === own.length;
};
