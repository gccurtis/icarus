import { Buffer } from "node:buffer";

import type { TableRow } from "$model/server/store/index.server";
import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import type { MaterialSeed } from "$representation/data/types/semantic/material";
import type { ProviderUsage } from "$representation/data/types/semantic/translation";
import {
  describeMaterial,
  MATERIAL_DESCRIPTOR_PROMPT_VERSION,
  materialDescriptorInputHash,
  materialDescriptorModel,
  shouldDescribeMaterial
} from "$capabilities/semantic-overlay/api/shared/material-description";
import { embedMaterialFacets } from "$capabilities/semantic-overlay/api/shared/material-facets";
import { materialHash } from "$capabilities/semantic-overlay/api/shared/material-hash";
import {
  canDescribeMaterial,
  materialContextHash,
  type NormalizedMaterial
} from "$capabilities/semantic-overlay/api/shared/material-normalization";
import {
  materialRevisionKey,
  type PreparedMaterial
} from "$capabilities/semantic-overlay/api/shared/material-publication";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";

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

const nativeImageReader = (model: ServerModel, projectId: Id<"projects">) => {
  const pendingByHash = new Map<string, Promise<MaterialSeed["nativeImage"]>>();
  return async (seed: MaterialSeed): Promise<{ seed: MaterialSeed; error?: string }> => {
    if (
      seed.kind !== "image" ||
      seed.nativeImage !== undefined ||
      seed.source.kind !== "externalFile"
    ) {
      return { seed };
    }
    const source = seed.source;
    const file = rowsOf(model.store, "externalFiles").find(
      (row) => row.projectId === projectId && row._id === source.fileId
    );
    if (file === undefined) return { seed, error: "Original image content is unavailable" };
    let pending = pendingByHash.get(file.hash);
    if (pending === undefined) {
      pending = model.materialContent
        .read({ storageId: file.storageId, hash: file.hash })
        .then((bytes) =>
          bytes === undefined || bytes.byteLength > 5_000_000
            ? undefined
            : {
                kind: "bytes" as const,
                base64: Buffer.from(bytes).toString("base64"),
                mediaType: file.mediaType
              }
        );
      pendingByHash.set(file.hash, pending);
    }
    try {
      const nativeImage = await pending;
      return nativeImage === undefined
        ? {
            seed,
            error: "Original image exceeds the semantic visual-input limit or is unavailable"
          }
        : { seed: { ...seed, nativeImage } };
    } catch (error) {
      return { seed, error: safeFailure(error) };
    }
  };
};

export const prepareMaterials = async (
  model: ServerModel,
  projectId: Id<"projects">,
  normalized: readonly NormalizedMaterial[],
  force: boolean
): Promise<{ prepared: PreparedMaterial[]; usage: ProviderUsage[] }> => {
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
  const readNativeImage = nativeImageReader(model, projectId);
  const prepared: PreparedMaterial[] = [];
  const usage: ProviderUsage[] = [];
  for (const candidate of normalized) {
    const { seed, contextRefs } = candidate;
    const profileHash = materialHash(seed.profile);
    const contextHash = materialContextHash(seed, contextRefs);
    const revisionKey = materialRevisionKey(seed);
    const prior = previous.get(seed.identityKey);
    const priorFacets =
      prior === undefined
        ? []
        : previousObjects.filter((object) => object.semanticMaterialId === prior._id);
    const priorVisual = priorFacets.find((object) => object.facet === "nativeVisual");
    const descriptionsEnabled =
      model.configuration.get("semanticOverlay.materials.generateDescriptors") === true;
    const priorDescriptor = prior?.descriptor;
    let descriptor = descriptionsEnabled ? priorDescriptor : undefined;
    let error: string | undefined;
    const descriptorInputHash = materialDescriptorInputHash(seed);
    const descriptorRemoved = !descriptionsEnabled && priorDescriptor !== undefined;
    const descriptorIsStale =
      descriptor !== undefined &&
      (descriptor.inputHash !== descriptorInputHash ||
        descriptor.promptVersion !== MATERIAL_DESCRIPTOR_PROMPT_VERSION ||
        descriptor.model !== materialDescriptorModel(model));
    const descriptorNeedsRefreshBeforeNative =
      force ||
      descriptorRemoved ||
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

    const descriptorNeedsNativeInput =
      descriptionsEnabled &&
      (force ||
        descriptorIsStale ||
        (descriptor === undefined && canDescribeMaterial(seed)));
    const native =
      seed.kind === "image" &&
      priorVisual !== undefined &&
      !force &&
      !descriptorNeedsNativeInput
        ? { seed }
        : await readNativeImage(seed);
    const preparedSeed = native.seed;
    error = native.error;
    const descriptorNeedsRefresh =
      force ||
      descriptorIsStale ||
      (descriptor === undefined &&
        descriptionsEnabled &&
        shouldDescribeMaterial(preparedSeed));
    if (descriptorNeedsRefresh) {
      try {
        descriptor = await describeMaterial(model, preparedSeed);
      } catch (failure) {
        descriptor = undefined;
        error = joinedFailure(error, safeFailure(failure));
      }
    }
    const embedded = await embedMaterialFacets(
      model,
      preparedSeed,
      descriptor,
      contextRefs,
      force ? [] : priorFacets
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
    const combinedError = joinedFailure(error, embedded.visualError);
    prepared.push({
      seed: preparedSeed,
      profileHash,
      contextHash,
      revisionKey,
      descriptor,
      facets: embedded.facets,
      placements: candidate.placements,
      ...(combinedError === undefined ? {} : { error: combinedError })
    });
  }
  return { prepared, usage };
};
