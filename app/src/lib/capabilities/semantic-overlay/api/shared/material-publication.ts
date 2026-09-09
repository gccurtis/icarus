import type { SemanticUnitModel } from "$capabilities/semantic-overlay/api/shared/unit-of-work";
import type { TableRow } from "$model/server/store/index.server";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type {
  GeneratedMaterialDescriptor,
  MaterialSeed,
  MaterialAuthoredContext,
  MaterialLocator,
  SemanticMaterialFields
} from "$representation/data/types/semantic/material";
import type { ProviderUsage } from "$representation/data/types/semantic/translation";
import { sameResourceRef } from "$capabilities/semantic-overlay/api/shared/resource-ref";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";
import { stageSemanticIndex } from "$capabilities/semantic-overlay/api/shared/index-publication";
import { ensureSemanticOverlay } from "$capabilities/semantic-overlay/api/shared/publication";
import { materialHash } from "$capabilities/semantic-overlay/api/shared/material-hash";
import type { EmbeddedMaterialFacet } from "$capabilities/semantic-overlay/api/shared/material-facets";
import type { SyncSemanticMaterialsResult } from "$capabilities/semantic-overlay/types/material-sync";

export type PreparedMaterial = {
  seed: MaterialSeed;
  profileHash: string;
  contextHash: string;
  revisionKey: string;
  descriptor?: GeneratedMaterialDescriptor;
  facets: EmbeddedMaterialFacet[];
  placements: Array<{
    placement: { ref: ResourceRef; revision: number; locator: MaterialLocator };
    context: MaterialAuthoredContext;
  }>;
  error?: string;
};

type MaterialObjectRow = Extract<TableRow<"semanticObjects">, { lane: "material" }>;

export const materialRevisionKey = (seed: MaterialSeed): string =>
  seed.source.kind === "externalFile"
    ? `hash:${seed.source.hash}`
    : `revision:${seed.source.ref.kind}:${seed.source.ref.id}:${seed.source.revision}`;

const fields = (prepared: PreparedMaterial, projectId: Id<"projects">): SemanticMaterialFields => ({
  projectId,
  identityKey: prepared.seed.identityKey,
  kind: prepared.seed.kind,
  name: prepared.seed.name,
  source: prepared.seed.source,
  profile: prepared.seed.profile,
  profileHash: prepared.profileHash,
  contextHash: prepared.contextHash,
  revisionKey: prepared.revisionKey,
  ...(prepared.seed.userDescription === undefined ? {} : { userDescription: prepared.seed.userDescription }),
  ...(prepared.descriptor === undefined ? {} : { descriptor: prepared.descriptor }),
  state: "ready",
  ...(prepared.error === undefined ? {} : { error: prepared.error }),
  updatedAt: Date.now()
});

const ownsResource = (material: TableRow<"semanticMaterials">, ref: ResourceRef): boolean =>
  sameResourceRef(material.source.ref, ref);

const materialObjects = (model: SemanticUnitModel, projectId: Id<"projects">) =>
  rowsOf(model.store, "semanticObjects").flatMap((object): MaterialObjectRow[] =>
    object.projectId === projectId && object.lane === "material"
      ? [object as MaterialObjectRow]
      : []
  );

const sameDescriptorIdentity = (
  left: GeneratedMaterialDescriptor | undefined,
  right: GeneratedMaterialDescriptor | undefined
): boolean => left === undefined && right === undefined || (
  left !== undefined &&
  right !== undefined &&
  left.inputHash === right.inputHash &&
  left.promptVersion === right.promptVersion &&
  left.model === right.model
);

/** Stages a complete material tree, then swaps records, placements, and generation synchronously. */
export const publishSemanticMaterials = (
  model: SemanticUnitModel,
  projectId: Id<"projects">,
  ref: ResourceRef,
  revision: number,
  prepared: readonly PreparedMaterial[],
  usage: readonly ProviderUsage[],
  force = false
): SyncSemanticMaterialsResult => {
  const overlay = ensureSemanticOverlay(model, projectId);
  const currentMaterials = rowsOf(model.store, "semanticMaterials").filter((row) => row.projectId === projectId);
  const currentByIdentity = new Map(currentMaterials.map((row) => [row.identityKey, row]));
  const currentPlacements = rowsOf(model.store, "semanticMaterialPlacements").filter(
    (row) => row.projectId === projectId
  );
  const oldForResource = new Set(
    currentPlacements.filter((placement) => sameResourceRef(placement.ref, ref)).map((placement) => placement.semanticMaterialId)
  );
  for (const material of currentMaterials) if (ownsResource(material, ref)) oldForResource.add(material._id);

  const reusable = new Map<string, TableRow<"semanticMaterials">>();
  if (!force) {
    for (const candidate of prepared) {
      const current = currentByIdentity.get(candidate.seed.identityKey);
      if (
        current !== undefined &&
        current.revisionKey === candidate.revisionKey &&
        current.profileHash === candidate.profileHash &&
        current.contextHash === candidate.contextHash &&
        sameDescriptorIdentity(current.descriptor, candidate.descriptor)
      ) reusable.set(candidate.seed.identityKey, current);
    }
  }
  const createdMaterialIds: Id<"semanticMaterials">[] = [];
  const materialFor = new Map<string, Id<"semanticMaterials">>();
  const replaced = new Map<Id<"semanticMaterials">, Id<"semanticMaterials">>();
  for (const candidate of prepared) {
    const held = reusable.get(candidate.seed.identityKey);
    if (held !== undefined) {
      materialFor.set(candidate.seed.identityKey, held._id);
      continue;
    }
    const id = model.store.create("semanticMaterials", fields(candidate, projectId));
    createdMaterialIds.push(id);
    materialFor.set(candidate.seed.identityKey, id);
    const previous = currentByIdentity.get(candidate.seed.identityKey);
    if (previous !== undefined) replaced.set(previous._id, id);
  }

  const oldObjects = materialObjects(model, projectId);
  const retiringMaterialIds = new Set<Id<"semanticMaterials">>();
  for (const id of oldForResource) {
    const material = currentMaterials.find((candidate) => candidate._id === id);
    if (
      material?.source.kind === "resourceContent" &&
      ![...materialFor.values()].includes(id)
    ) retiringMaterialIds.add(id);
  }
  for (const id of replaced.keys()) retiringMaterialIds.add(id);
  const retiringObjectIds = new Set(
    oldObjects.filter((object) => retiringMaterialIds.has(object.semanticMaterialId)).map((object) => object._id)
  );
  const newObjectIds: Id<"semanticObjects">[] = [];
  for (const candidate of prepared) {
    if (reusable.has(candidate.seed.identityKey)) continue;
    const materialId = materialFor.get(candidate.seed.identityKey)!;
    newObjectIds.push(...model.store.createMany("semanticObjects", candidate.facets.map((facet) => ({
      projectId,
      lane: "material" as const,
      semanticMaterialId: materialId,
      facet: facet.facet,
      ...(facet.text === undefined ? {} : { facetText: facet.text }),
      inputHash: facet.inputHash,
      ...(facet.scopeRefs === undefined ? {} : { scopeRefs: facet.scopeRefs }),
      vector: facet.vector
    }))));
  }
  const candidateObjects = materialObjects(model, projectId)
    .filter((object) => !retiringObjectIds.has(object._id))
    .map((object) => ({ id: object._id, vector: object.vector }));

  let staged;
  try {
    staged = stageSemanticIndex(model, projectId, overlay, candidateObjects, "material");
  } catch (error) {
    if (newObjectIds.length > 0) model.store.removeRows("semanticObjects", newObjectIds);
    if (createdMaterialIds.length > 0) model.store.removeRows("semanticMaterials", createdMaterialIds);
    throw error;
  }

  const at = Date.now();
  const nextGeneration = overlay.generation + 1;
  const resourcePlacements = currentPlacements.filter((placement) => sameResourceRef(placement.ref, ref));
  const replacedPlacements = currentPlacements.filter((placement) => replaced.has(placement.semanticMaterialId));
  const removePlacements = [...new Map(
    [...resourcePlacements, ...replacedPlacements].map((placement) => [placement._id, placement])
  ).values()];
  if (removePlacements.length > 0) {
    model.store.removeRows("semanticMaterialPlacements", removePlacements.map((placement) => placement._id));
  }
  const copiedPlacements = replacedPlacements
    .filter((placement) => !sameResourceRef(placement.ref, ref))
    .map((placement) => ({
      projectId,
      semanticMaterialId: replaced.get(placement.semanticMaterialId)!,
      ref: placement.ref,
      revision: placement.revision,
      locator: placement.locator,
      context: placement.context,
      contextHash: placement.contextHash,
      updatedAt: at
    }));
  const seededPlacements = prepared.flatMap((candidate) =>
    candidate.placements.map(({ placement, context }) => ({
      projectId,
      semanticMaterialId: materialFor.get(candidate.seed.identityKey)!,
      ref: placement.ref,
      revision: placement.revision,
      locator: placement.locator,
      context,
      contextHash: materialHash(context),
      updatedAt: at
    }))
  );
  model.store.createMany("semanticMaterialPlacements", [...copiedPlacements, ...seededPlacements]);

  const retiring = currentMaterials.filter((material) => retiringMaterialIds.has(material._id));
  if (retiring.length > 0) {
    model.store.createMany("semanticMaterialHistory", retiring.map((material) => {
      const { _id, _creationTime, ...materialFields } = material;
      void _id;
      void _creationTime;
      return { projectId, retiredGeneration: nextGeneration, material: materialFields, retiredAt: at };
    }));
    model.store.createMany("semanticObjectHistory", oldObjects
      .filter((object) => retiringObjectIds.has(object._id))
      .map((object) => ({
        projectId,
        retiredGeneration: nextGeneration,
        object: {
          lane: "material" as const,
          semanticMaterialId: object.semanticMaterialId,
          facet: object.facet,
          ...(object.facetText === undefined ? {} : { facetText: object.facetText }),
          inputHash: object.inputHash,
          ...(object.scopeRefs === undefined ? {} : { scopeRefs: object.scopeRefs }),
          vector: object.vector
        },
        retiredAt: at
      })));
    if (retiringObjectIds.size > 0) model.store.removeRows("semanticObjects", [...retiringObjectIds]);
    model.store.removeRows("semanticMaterials", retiring.map((material) => material._id));
  }
  model.store.update(`semanticOverlays.${overlay._id}.generation`, nextGeneration);
  model.store.update(`semanticOverlays.${overlay._id}.updatedAt`, at);
  staged.commit();
  return {
    outcome: "published",
    ref,
    revision,
    overlayGeneration: nextGeneration,
    materialCount: prepared.length,
    facetCount: candidateObjects.length,
    index: {
      indexId: staged.indexId,
      objectCount: staged.objectCount,
      nodeCount: staged.nodeCount,
      rootCount: staged.rootCount
    },
    usage: [...usage]
  };
};
