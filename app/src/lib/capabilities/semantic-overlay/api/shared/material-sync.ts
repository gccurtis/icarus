import { Buffer } from "node:buffer";

import type { TableRow } from "$model/server/store/index.server";
import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type {
  MaterialAuthoredContext,
  MaterialSeed
} from "$representation/data/types/semantic/material";
import type { ProviderUsage } from "$representation/data/types/semantic/translation";
import { fileSubkindFor } from "$representation/data/behavior/external/file";
import { readMaterialInventoryFor } from "$capabilities/semantic-overlay/api/shared/material-resource";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";
import { sameResourceRef } from "$capabilities/semantic-overlay/api/shared/resource-ref";
import { materialHash } from "$capabilities/semantic-overlay/api/shared/material-hash";
import {
  describeMaterial,
  MATERIAL_DESCRIPTOR_PROMPT_VERSION,
  materialDescriptorModel,
  materialDescriptorInputHash,
  shouldDescribeMaterial
} from "$capabilities/semantic-overlay/api/shared/material-description";
import { embedMaterialFacets } from "$capabilities/semantic-overlay/api/shared/material-facets";
import {
  materialRevisionKey,
  publishSemanticMaterials,
  type PreparedMaterial
} from "$capabilities/semantic-overlay/api/shared/material-publication";
import type { SyncSemanticMaterialsResult } from "$capabilities/semantic-overlay/types/material-sync";

type MaterialObjectRow = Extract<TableRow<"semanticObjects">, { lane: "material" }>;

const safeFailure = (error: unknown): string =>
  (error instanceof Error ? error.message : "Material description failed")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(?:api[-_ ]?key)\s*[:=]\s*\S+/gi, "apiKey=[redacted]")
    .slice(0, 400);

const joinedFailure = (...values: Array<string | undefined>): string | undefined => {
  const messages = [...new Set(values.filter((value): value is string => Boolean(value)))];
  return messages.length === 0 ? undefined : messages.join("; ").slice(0, 400);
};

const unique = (values: readonly (string | undefined)[], limit: number): string[] =>
  [...new Set(values.filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map((value) => value.trim()))]
    .slice(0, limit);

const mergedContext = (values: readonly MaterialAuthoredContext[]): MaterialAuthoredContext => {
  const title = unique(values.map((value) => value.title), 1)[0];
  const caption = unique(values.map((value) => value.caption), 1)[0];
  const alt = unique(values.map((value) => value.alt), 1)[0];
  const userDescription = unique(values.map((value) => value.userDescription), 1)[0];
  const alternateLabels = unique(values.flatMap((value) => [value.title, value.caption, value.alt]), 24)
    .filter((value) => value !== title && value !== caption && value !== alt);
  return {
    ...(title === undefined ? {} : { title }),
    ...(caption === undefined ? {} : { caption }),
    ...(alt === undefined ? {} : { alt }),
    ...(userDescription === undefined ? {} : { userDescription }),
    nearbyText: unique([...alternateLabels, ...values.flatMap((value) => value.nearbyText)], 24),
    notes: unique(values.flatMap((value) => value.notes), 12)
  };
};

const inventorySignature = (seeds: readonly MaterialSeed[]): string =>
  materialHash(seeds
    .map((seed) => materialHash({
      identityKey: seed.identityKey,
      source: seed.source,
      profile: seed.profile,
      context: seed.context,
      placement: seed.placement
    }))
    .sort());

/** Whether the current runtime has enough authority to attempt a descriptor. */
const canDescribeMaterial = (seed: MaterialSeed): boolean =>
  shouldDescribeMaterial(seed) || (seed.kind === "image" && seed.source.kind === "externalFile");

const descriptorPolicyIsCurrent = (
  model: ServerModel,
  material: TableRow<"semanticMaterials">,
  seed: MaterialSeed
): boolean => {
  if (model.configuration.get("semanticOverlay.materials.generateDescriptors") !== true) return true;
  const descriptor = material.descriptor;
  if (descriptor !== undefined) return (
    descriptor.inputHash === materialDescriptorInputHash(seed) &&
    descriptor.promptVersion === MATERIAL_DESCRIPTOR_PROMPT_VERSION &&
    descriptor.model === materialDescriptorModel(model)
  );
  // A prior bounded/native-read failure is stable until a forced retry or a
  // changed revision/context creates a new material candidate.
  return !canDescribeMaterial(seed) || material.error !== undefined;
};

/**
 * A document can remove its final placement of a shared image. Keep the asset
 * itself in the material lane while rebuilding its aggregate context without
 * the departed placement.
 */
const withDepartedExternalImages = (
  model: ServerModel,
  projectId: Id<"projects">,
  ref: ResourceRef,
  seeds: readonly MaterialSeed[]
): MaterialSeed[] => {
  const desired = new Set(seeds.map((seed) => seed.identityKey));
  const materials = rowsOf(model.store, "semanticMaterials").filter(
    (material) => material.projectId === projectId
  );
  const byId = new Map(materials.map((material) => [material._id, material]));
  const departed = rowsOf(model.store, "semanticMaterialPlacements")
    .filter((placement) => placement.projectId === projectId && sameResourceRef(placement.ref, ref))
    .flatMap((placement) => {
      const material = byId.get(placement.semanticMaterialId);
      if (
        material === undefined ||
        desired.has(material.identityKey) ||
        material.source.kind !== "externalFile" ||
        material.kind !== "image" ||
        material.profile.kind !== "image"
      ) return [];
      const externalSource = material.source;
      const file = rowsOf(model.store, "externalFiles").find(
        (row) => row.projectId === projectId && row._id === externalSource.fileId
      );
      if (file === undefined || file.hash !== externalSource.hash) return [];
      const subkind = file.subkind ?? fileSubkindFor(file.mediaType, file.name);
      desired.add(material.identityKey);
      const context = {
        title: file.name,
        ...(material.userDescription === undefined
          ? {}
          : { userDescription: material.userDescription }),
        nearbyText: [],
        notes: []
      };
      return [{
        identityKey: material.identityKey,
        kind: "image" as const,
        name: file.name,
        source: {
          ...externalSource,
          ref: { kind: `externalFile::${subkind}`, id: file._id },
          mediaType: file.mediaType,
          subkind
        },
        profile: { ...material.profile, mediaType: file.mediaType, placementCount: 0 },
        context,
        ...(material.userDescription === undefined
          ? {}
          : { userDescription: material.userDescription })
      }];
    });
  return [...seeds, ...departed];
};

type NormalizedMaterial = {
  seed: MaterialSeed;
  placements: PreparedMaterial["placements"];
  /** Every resource whose bounded authored context contributes to this material. */
  contextRefs: ResourceRef[];
};

const uniqueResourceRefs = (refs: readonly ResourceRef[]): ResourceRef[] =>
  [...new Map(refs.map((held) => [`${held.kind}\u0000${held.id}`, held])).values()]
    .sort((left, right) =>
      left.kind.localeCompare(right.kind) || String(left.id).localeCompare(String(right.id))
    );

const materialContextHash = (
  seed: MaterialSeed,
  contextRefs: readonly ResourceRef[]
): string => materialHash({ context: seed.context, scopeRefs: contextRefs });

const canonicalProfile = (seed: MaterialSeed): unknown => {
  if (seed.profile.kind !== "image") return seed.profile;
  const { alt, caption, placementCount, ...native } = seed.profile;
  void alt;
  void caption;
  void placementCount;
  return native;
};

/**
 * One immutable asset can occur in several blocks or resources. Collapse those
 * occurrences into one semantic material while retaining every placement and
 * aggregating only bounded authored context.
 */
const normalizeMaterials = (
  model: ServerModel,
  projectId: Id<"projects">,
  ref: ResourceRef,
  seeds: readonly MaterialSeed[]
): NormalizedMaterial[] => {
  const materials = rowsOf(model.store, "semanticMaterials").filter(
    (material) => material.projectId === projectId
  );
  const priorByIdentity = new Map(materials.map((material) => [material.identityKey, material]));
  const allPlacements = rowsOf(model.store, "semanticMaterialPlacements").filter(
    (placement) => placement.projectId === projectId
  );
  const groups = new Map<string, MaterialSeed[]>();
  for (const seed of seeds) groups.set(seed.identityKey, [...(groups.get(seed.identityKey) ?? []), seed]);

  return [...groups.values()].map((group) => {
    const first = group[0];
    const incompatible = group.some((seed) =>
      seed.kind !== first.kind ||
      materialHash(seed.source) !== materialHash(first.source) ||
      materialHash(canonicalProfile(seed)) !== materialHash(canonicalProfile(first))
    );
    if (incompatible) throw new Error(`Material identity '${first.identityKey}' resolved to incompatible native values`);
    const placements = group.flatMap((seed) => seed.placement === undefined
      ? []
      : [{ placement: seed.placement, context: seed.context }]);
    const prior = priorByIdentity.get(first.identityKey);
    const retainedPlacements = first.source.kind !== "externalFile" || prior === undefined
      ? []
      : allPlacements.filter((placement) =>
          placement.semanticMaterialId === prior._id && !sameResourceRef(placement.ref, ref)
        );
    const context = mergedContext([
      ...group.map((seed) => seed.context),
      ...retainedPlacements.map((placement) => placement.context)
    ]);
    const contextRefs = uniqueResourceRefs([
      ...group.map((seed) => seed.placement?.ref ?? seed.source.ref),
      ...retainedPlacements.map((placement) => placement.ref)
    ]);
    const placementCount = placements.length + retainedPlacements.length;
    const profile = first.profile.kind === "image"
      ? (() => {
          const { alt, caption, ...native } = first.profile;
          void alt;
          void caption;
          return {
            ...native,
            placementCount,
            ...(context.alt === undefined ? {} : { alt: context.alt }),
            ...(context.caption === undefined ? {} : { caption: context.caption })
          };
        })()
      : first.profile;
    return {
      seed: { ...first, profile, context },
      placements,
      contextRefs
    };
  });
};

const isCurrent = (
  model: ServerModel,
  projectId: Id<"projects">,
  ref: ResourceRef,
  desired: readonly NormalizedMaterial[]
): boolean => {
  const materials = rowsOf(model.store, "semanticMaterials").filter(
    (material) => material.projectId === projectId
  );
  const byIdentity = new Map(materials.map((material) => [material.identityKey, material]));
  const placements = rowsOf(model.store, "semanticMaterialPlacements").filter(
    (placement) => placement.projectId === projectId && sameResourceRef(placement.ref, ref)
  );
  const desiredIdentities = new Set(desired.map(({ seed }) => seed.identityKey));
  const currentIdentities = new Set([
    ...placements.flatMap((placement) => {
      const material = materials.find((candidate) => candidate._id === placement.semanticMaterialId);
      return material === undefined ? [] : [material.identityKey];
    }),
    ...materials.filter((material) => sameResourceRef(material.source.ref, ref)).map((material) => material.identityKey)
  ]);
  if (
    currentIdentities.size !== desiredIdentities.size ||
    [...currentIdentities].some((identity) => !desiredIdentities.has(identity))
  ) return false;

  return desired.every(({ seed, placements: expectedPlacements, contextRefs }) => {
    const material = byIdentity.get(seed.identityKey);
    if (
      material === undefined ||
      material.revisionKey !== materialRevisionKey(seed) ||
      material.profileHash !== materialHash(seed.profile) ||
      material.contextHash !== materialContextHash(seed, contextRefs) ||
      !descriptorPolicyIsCurrent(model, material, seed)
    ) return false;
    const actual = placements
      .filter((placement) => placement.semanticMaterialId === material._id)
      .map((placement) => materialHash({
        ref: placement.ref,
        revision: placement.revision,
        locator: placement.locator,
        context: placement.context
      }))
      .sort();
    const expected = expectedPlacements
      .map(({ placement, context }) => materialHash({ ...placement, context }))
      .sort();
    return materialHash(actual) === materialHash(expected);
  });
};

export const syncSemanticMaterialsFor = async (
  model: ServerModel,
  projectId: Id<"projects">,
  ref: ResourceRef,
  force = false
): Promise<SyncSemanticMaterialsResult> => {
  const inventory = await readMaterialInventoryFor(model, projectId, ref);
  if (inventory === undefined) return { outcome: "missing", ref };
  const inventorySeeds = withDepartedExternalImages(
    model,
    projectId,
    ref,
    inventory.seeds
  );
  const requestedSignature = inventorySignature(inventorySeeds);
  const normalized = normalizeMaterials(model, projectId, ref, inventorySeeds);
  const materialIndex = rowsOf(model.store, "semanticIndexes").find(
    (index) => index.projectId === projectId && index.lane === "material"
  );
  if (!force && materialIndex !== undefined && isCurrent(model, projectId, ref, normalized)) {
    const overlay = rowsOf(model.store, "semanticOverlays")
      .filter((row) => row.projectId === projectId)
      .sort((left, right) => right.generation - left.generation)[0];
    return {
      outcome: "current",
      ref,
      revision: inventory.revision,
      overlayGeneration: overlay?.generation ?? 0,
      materialCount: normalized.length,
      facetCount: rowsOf(model.store, "semanticObjects").filter(
        (object) => object.projectId === projectId && object.lane === "material"
      ).length,
      usage: []
    };
  }

  const previous = new Map(
    rowsOf(model.store, "semanticMaterials")
      .filter((material) => material.projectId === projectId)
      .map((material) => [material.identityKey, material])
  );
  const previousObjects = rowsOf(model.store, "semanticObjects").flatMap(
    (object): MaterialObjectRow[] =>
      object.projectId === projectId && object.lane === "material"
        ? [object as MaterialObjectRow]
        : []
  );
  const nativeImages = new Map<string, Promise<MaterialSeed["nativeImage"]>>();
  const withNativeImage = async (seed: MaterialSeed): Promise<{ seed: MaterialSeed; error?: string }> => {
    if (seed.kind !== "image" || seed.nativeImage !== undefined || seed.source.kind !== "externalFile") {
      return { seed };
    }
    const externalSource = seed.source;
    const file = rowsOf(model.store, "externalFiles").find(
      (row) => row.projectId === projectId && row._id === externalSource.fileId
    );
    if (file === undefined) return { seed, error: "Original image content is unavailable" };
    let pending = nativeImages.get(file.hash);
    if (pending === undefined) {
      pending = model.materialContent.read({ storageId: file.storageId, hash: file.hash })
        .then((bytes) => bytes === undefined || bytes.byteLength > 5_000_000
          ? undefined
          : {
              kind: "bytes" as const,
              base64: Buffer.from(bytes).toString("base64"),
              mediaType: file.mediaType
            });
      nativeImages.set(file.hash, pending);
    }
    try {
      const nativeImage = await pending;
      return nativeImage === undefined
        ? { seed, error: "Original image exceeds the semantic visual-input limit or is unavailable" }
        : { seed: { ...seed, nativeImage } };
    } catch (error) {
      return { seed, error: safeFailure(error) };
    }
  };
  const prepared: PreparedMaterial[] = [];
  const usage: ProviderUsage[] = [];
  for (const candidate of normalized) {
    const { seed, contextRefs } = candidate;
    const profileHash = materialHash(seed.profile);
    const contextHash = materialContextHash(seed, contextRefs);
    const revisionKey = materialRevisionKey(seed);
    const prior = previous.get(seed.identityKey);
    let descriptor = prior?.descriptor;
    let error: string | undefined;
    const descriptorInputHash = materialDescriptorInputHash(seed);
    const descriptionsEnabled = model.configuration.get(
      "semanticOverlay.materials.generateDescriptors"
    ) === true;
    const descriptorIsStale = descriptor !== undefined && (
      descriptor.inputHash !== descriptorInputHash ||
      descriptor.promptVersion !== MATERIAL_DESCRIPTOR_PROMPT_VERSION ||
      descriptor.model !== materialDescriptorModel(model)
    );
    const descriptorNeedsRefreshBeforeNative =
      force ||
      descriptorIsStale ||
      (descriptor === undefined && descriptionsEnabled && canDescribeMaterial(seed));
    const reusable =
      !force &&
      !descriptorNeedsRefreshBeforeNative &&
      prior !== undefined &&
      prior.error === undefined &&
      prior.revisionKey === revisionKey &&
      prior.profileHash === profileHash &&
      prior.contextHash === contextHash &&
      previousObjects.some((object) => object.semanticMaterialId === prior._id);
    if (reusable) {
      prepared.push({
        seed,
        profileHash,
        contextHash,
        revisionKey,
        descriptor,
        facets: [],
        placements: candidate.placements
      });
      continue;
    }

    const native = await withNativeImage(seed);
    const preparedSeed = native.seed;
    error = native.error;
    const descriptorNeedsRefresh =
      force ||
      descriptorIsStale ||
      (descriptor === undefined && descriptionsEnabled && shouldDescribeMaterial(preparedSeed));
    if (descriptorNeedsRefresh) {
      try {
        descriptor = await describeMaterial(model, preparedSeed);
      } catch (failure) {
        descriptor = undefined;
        error = joinedFailure(error, safeFailure(failure));
      }
    }
    const embedded = await embedMaterialFacets(model, preparedSeed, descriptor, contextRefs);
    const priorVisual = prior === undefined
      ? undefined
      : previousObjects.find(
          (object) => object.semanticMaterialId === prior._id && object.facet === "nativeVisual"
        );
    if (
      !embedded.facets.some((facet) => facet.facet === "nativeVisual") &&
      priorVisual !== undefined &&
      prior?.revisionKey === revisionKey
    ) {
      embedded.facets.push({
        facet: "nativeVisual",
        trust: "native",
        inputHash: priorVisual.inputHash,
        vector: priorVisual.vector
      });
    }
    usage.push(...embedded.usage);
    prepared.push({
      seed: preparedSeed,
      profileHash,
      contextHash,
      revisionKey,
      descriptor,
      facets: embedded.facets,
      placements: candidate.placements,
      ...(joinedFailure(error, embedded.visualError) === undefined
        ? {}
        : { error: joinedFailure(error, embedded.visualError) })
    });
  }

  const latest = await readMaterialInventoryFor(model, projectId, ref);
  const latestSeeds = latest === undefined
    ? []
    : withDepartedExternalImages(model, projectId, ref, latest.seeds);
  if (
    latest === undefined ||
    latest.revision !== inventory.revision ||
    inventorySignature(latestSeeds) !== requestedSignature
  ) {
    const overlay = rowsOf(model.store, "semanticOverlays")
      .filter((row) => row.projectId === projectId)
      .sort((left, right) => right.generation - left.generation)[0];
    return {
      outcome: "superseded",
      ref,
      revision: latest?.revision ?? inventory.revision,
      overlayGeneration: overlay?.generation ?? 0,
      materialCount: 0,
      facetCount: 0,
      usage
    };
  }
  return publishSemanticMaterials(model, projectId, ref, inventory.revision, prepared, usage, force);
};
