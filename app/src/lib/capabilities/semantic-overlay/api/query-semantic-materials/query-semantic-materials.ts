import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { searchRecursiveObjects } from "$representation/data/behavior/semantic/query";
import { resourceInScope } from "$representation/data/behavior/semantic/scope";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { MaterialHit, MaterialSourceSnapshot } from "$representation/data/types/semantic/material";
import type { SearchableMaterialObject } from "$representation/data/types/semantic/index";
import { currentOverlay } from "$capabilities/semantic-overlay/api/shared/overlay";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";
import { materialProfileDigest } from "$capabilities/semantic-overlay/api/shared/material-facets";
import { materialRecordIsCurrent } from "$capabilities/semantic-overlay/api/shared/freshness";
import { validateQuerySemanticMaterials } from "$capabilities/semantic-overlay/api/query-semantic-materials/validate-query-semantic-materials";
import type { QuerySemanticMaterialsResult } from "$capabilities/semantic-overlay/types/query-semantic-materials";

const emptyDiagnostics = () => ({
  eligibleObjects: 0,
  candidateTarget: 0,
  visitedNodes: 0,
  evaluatedObjects: 0,
  exhausted: true
});

const sourceRef = (material: { source: { kind: string; ref: ResourceRef } }): ResourceRef => material.source.ref;

const sameSpace = (
  left: { provider: string; model: string; dimensions: number },
  right: { provider: string; model: string; dimensions: number }
): boolean =>
  left.provider === right.provider &&
  left.model === right.model &&
  left.dimensions === right.dimensions;

export const querySemanticMaterials = async (
  input: unknown
): Promise<QuerySemanticMaterialsResult> => {
  const scope = await requireScope();
  const asked = validateQuerySemanticMaterials(input);
  const model = serverModel();
  const projectId = scope.projectId as Id<"projects">;
  const overlay = currentOverlay(model.store, projectId);
  if (!sameSpace(overlay.embedding, model.embedding.space)) {
    throw new Error("The active Semantic Overlay and configured embedding model use different vector spaces");
  }
  const projectPlacements = rowsOf(model.store, "semanticMaterialPlacements").filter(
    (placement) => placement.projectId === projectId
  );
  const allMaterials = rowsOf(model.store, "semanticMaterials").filter(
    (material) =>
      material.projectId === projectId &&
      material.state === "ready" &&
      materialRecordIsCurrent(model.store, projectId, material, projectPlacements)
  );
  const materialById = new Map(allMaterials.map((material) => [material._id, material]));
  const placements = projectPlacements.filter((placement) =>
    materialById.has(placement.semanticMaterialId)
  );
  const placementsByMaterial = new Map<Id<"semanticMaterials">, typeof placements>();
  for (const placement of placements) {
    placementsByMaterial.set(placement.semanticMaterialId, [
      ...(placementsByMaterial.get(placement.semanticMaterialId) ?? []),
      placement
    ]);
  }
  const namedSets = new Map(
    rowsOf(model.store, "resourceSets")
      .filter((row) => row.projectId === projectId)
      .map((row) => [row._id, row.set])
  );
  const matchesScope = (ref: ResourceRef): boolean => asked.scope === undefined ||
    resourceInScope(ref, asked.scope, (id) => namedSets.get(id));
  const eligibleMaterials = new Set(
    allMaterials
      .filter((material) =>
        (asked.kinds === undefined || asked.kinds.includes(material.kind)) &&
        (matchesScope(sourceRef(material)) ||
          (placementsByMaterial.get(material._id) ?? []).some((placement) => matchesScope(placement.ref)))
      )
      .map((material) => material._id)
  );
  const objects: SearchableMaterialObject[] = rowsOf(model.store, "semanticObjects").flatMap(
    (object): SearchableMaterialObject[] => {
    if (
      object.projectId !== projectId ||
      object.lane !== "material" ||
      !materialById.has(object.semanticMaterialId)
    ) return [];
    const base = {
      id: object._id,
      vector: object.vector,
      materialId: object.semanticMaterialId,
      ...(object.facetText === undefined ? {} : { facetText: object.facetText }),
      inputHash: object.inputHash
    };
    return object.facet === "authored" || object.facet === "generated"
      ? [{ ...base, facet: object.facet, scopeRefs: object.scopeRefs }]
      : [{ ...base, facet: object.facet }];
    }
  );
  const eligibleObjectIds = objects
    .filter((object) => {
      if (!eligibleMaterials.has(object.materialId)) return false;
      const contextual = object.facet === "authored" || object.facet === "generated";
      if (!contextual || asked.scope === undefined) return true;
      return object.scopeRefs.length > 0 &&
        object.scopeRefs.every(matchesScope);
    })
    .map((object) => object.id);
  if (eligibleObjectIds.length === 0) return {
    overlayGeneration: overlay.generation,
    hits: [],
    usage: [],
    diagnostics: emptyDiagnostics()
  };
  const index = rowsOf(model.store, "semanticIndexes")
    .filter((row) =>
      row.projectId === projectId &&
      row.semanticOverlayId === overlay._id &&
      row.method === "recursiveClustering" &&
      row.lane === "material" &&
      row.rootNodeIds.length > 0
    )
    .sort((left, right) => right._creationTime - left._creationTime)[0];
  if (index === undefined) throw new Error("The active Semantic Overlay has no material index");
  const nodes = rowsOf(model.store, "semanticIndexNodes")
    .filter((node) => node.projectId === projectId && node.indexId === index._id)
    .map((node) => ({ id: node._id, centroidVector: node.centroidVector, children: node.children }));
  const embedded = await model.embedding.query(asked.text);
  const searched = searchRecursiveObjects({
    queryVector: embedded.value,
    rootNodeIds: index.rootNodeIds,
    nodes,
    objects,
    eligibleObjectIds,
    // Search facets, then group. Five is the maximum number of facets per
    // material, so this preserves room for topK distinct material results.
    topK: Math.min(eligibleObjectIds.length, asked.topK * 5),
    configuration: index.configuration
  });
  const objectById = new Map(objects.map((object) => [object.id, object]));
  const groups = new Map<Id<"semanticMaterials">, { objects: SearchableMaterialObject[]; score: number }>();
  for (const scored of searched.objects) {
    const object = objectById.get(scored.id);
    if (object === undefined) continue;
    const group = groups.get(object.materialId) ?? { objects: [], score: scored.score };
    group.objects.push(object);
    group.score = Math.max(group.score, scored.score);
    groups.set(object.materialId, group);
  }
  const hits: MaterialHit[] = [...groups]
    .map(([materialId, group]) => {
      const material = materialById.get(materialId)!;
      const profileFacet = objects.find(
        (object) => object.materialId === materialId && object.facet === "profile"
      );
      if (profileFacet?.facetText === undefined) {
        throw new Error(`Semantic material '${materialId}' has no readable profile facet`);
      }
      const placement = (placementsByMaterial.get(materialId) ?? []).find((held) => matchesScope(held.ref));
      const snapshot: MaterialSourceSnapshot = {
        materialId,
        kind: material.kind,
        name: material.name,
        source: material.source,
        profileHash: material.profileHash,
        contextHash: material.contextHash,
        revisionKey: material.revisionKey,
        ...(placement === undefined ? {} : {
          placement: { ref: placement.ref, revision: placement.revision, locator: placement.locator }
        })
      };
      const matchedFacets = [...new Set(group.objects.map((object) => object.facet))];
      const description = matchedFacets.includes("generated") && material.descriptor !== undefined
        ? {
            provenance: "generated" as const,
            text: material.descriptor.summary,
            model: material.descriptor.model,
            promptVersion: material.descriptor.promptVersion,
            coverage: material.descriptor.coverage
          }
        : !matchedFacets.includes("authored") || material.userDescription === undefined
          ? undefined
          : { provenance: "authored" as const, text: material.userDescription };
      return {
        semanticObjectIds: group.objects.map((object) => object.id),
        evidenceKind: "interpreted" as const,
        material: snapshot,
        profile: materialProfileDigest(material.profile),
        profileFacet: { inputHash: profileFacet.inputHash, text: profileFacet.facetText },
        ...(description === undefined ? {} : { description }),
        matchedFacets,
        matched: group.objects.map((object) => ({
          facet: object.facet,
          inputHash: object.inputHash,
          ...(object.facetText === undefined ? {} : { text: object.facetText })
        })),
        score: group.score,
        overlayGeneration: overlay.generation
      };
    })
    .sort((left, right) => right.score - left.score || left.material.name.localeCompare(right.material.name))
    .slice(0, asked.topK);
  return {
    overlayGeneration: overlay.generation,
    hits,
    usage: [embedded.usage],
    diagnostics: searched.diagnostics
  };
};
