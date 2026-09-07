import type { ServerModel } from "$runtime/server/start.server";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type {
  GeneratedMaterialDescriptor,
  MaterialFacetKind,
  MaterialProfile,
  MaterialProfileDigest,
  MaterialSeed,
  MaterialTrust,
  SemanticMaterialFacet
} from "$representation/data/types/semantic/material";
import type { ProviderUsage } from "$representation/data/types/semantic/translation";
import { materialHash } from "$capabilities/semantic-overlay/api/shared/material-hash";

export type EmbeddedMaterialFacet = SemanticMaterialFacet & { vector: number[] };

const profileFacts = (profile: MaterialProfile): string[] => {
  if (profile.kind === "csv" || profile.kind === "table") return [
    profile.kind === "csv" && profile.truncated
      ? `at least ${profile.rows} parsed rows (profile truncated)`
      : `${profile.rows} rows`,
    `${profile.columns} columns`,
    ...(profile.headers.filter(Boolean).length ? [`headers ${profile.headers.filter(Boolean).join(", ")}`] : []),
    ...profile.columnsProfile.slice(0, 40).map((column) => `${column.name} ${column.inferredType}`)
  ];
  if (profile.kind === "chart") return [
    `${profile.chartType} chart`,
    ...(profile.title ? [`title ${profile.title}`] : []),
    ...(profile.series.length ? [`series ${profile.series.join(", ")}`] : []),
    ...(profile.measures.length ? [`measures ${profile.measures.join(", ")}`] : [])
  ];
  if (profile.kind === "image") return [
    "image",
    ...(profile.mediaType ? [profile.mediaType] : [])
  ];
  return [
    `${profile.language} code`,
    `${profile.lines} lines`,
    ...(profile.imports.length ? [`imports ${profile.imports.join(", ")}`] : []),
    ...(profile.exports.length ? [`exports ${profile.exports.join(", ")}`] : []),
    ...(profile.symbols.length ? [`symbols ${profile.symbols.map((symbol) => symbol.name).join(", ")}`] : [])
  ];
};

export const materialProfileDigest = (profile: MaterialProfile): MaterialProfileDigest => ({
  facts: profileFacts(profile),
  warnings: profile.warnings
});

const descriptorText = (descriptor: GeneratedMaterialDescriptor): string => [
  descriptor.summary,
  descriptor.purpose ?? "",
  descriptor.entities.join(", "),
  descriptor.measures.join(", "),
  descriptor.dimensions.join(", "),
  descriptor.timeRange ?? "",
  descriptor.themes.join(", "),
  descriptor.uncertainty.join(", ")
].filter(Boolean).join(". ");

const textFacets = (
  seed: MaterialSeed,
  descriptor: GeneratedMaterialDescriptor | undefined,
  contextRefs: readonly ResourceRef[]
): Array<{
  facet: MaterialFacetKind;
  trust: MaterialTrust;
  text: string;
  scopeRefs?: ResourceRef[];
}> => {
  const identity = `${seed.name}. ${seed.kind}.`;
  const profile = profileFacts(seed.profile).join(". ");
  const authored = [
    seed.userDescription,
    seed.context.title,
    seed.context.caption,
    seed.context.alt,
    ...seed.context.nearbyText,
    ...seed.context.notes
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(". ");
  return [
    { facet: "identity", trust: "exact", text: identity },
    ...(profile ? [{ facet: "profile" as const, trust: "exact" as const, text: profile }] : []),
    ...(authored ? [{
      facet: "authored" as const,
      trust: "authored" as const,
      text: authored,
      scopeRefs: [...contextRefs]
    }] : []),
    ...(descriptor === undefined
      ? []
      : [{
          facet: "generated" as const,
          trust: "interpreted" as const,
          text: descriptorText(descriptor),
          scopeRefs: [...contextRefs]
        }])
  ];
};

export const embedMaterialFacets = async (
  model: ServerModel,
  seed: MaterialSeed,
  descriptor?: GeneratedMaterialDescriptor,
  contextRefs: readonly ResourceRef[] = []
): Promise<{ facets: EmbeddedMaterialFacet[]; usage: ProviderUsage[]; visualError?: string }> => {
  const values = textFacets(seed, descriptor, contextRefs);
  const embedded = await model.embedding.passages(values.map((value) => value.text));
  const facets: EmbeddedMaterialFacet[] = values.map((value, index) => ({
    ...value,
    inputHash: materialHash([value.facet, value.text]),
    vector: embedded.value[index]
  }));
  const usage = [embedded.usage];
  if (seed.kind === "image" && seed.nativeImage !== undefined) {
    try {
      const visual = await model.embedding.image(seed.nativeImage);
      facets.push({
        facet: "nativeVisual",
        trust: "native",
        inputHash: materialHash(["nativeVisual", seed.profile.kind === "image" ? seed.profile.assetHash : seed.identityKey]),
        vector: visual.value
      });
      usage.push(visual.usage);
    } catch (error) {
      const visualError = (error instanceof Error ? error.message : "Native image embedding failed")
        .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
        .replace(/(?:api[-_ ]?key)\s*[:=]\s*\S+/gi, "apiKey=[redacted]")
        .slice(0, 400);
      return { facets, usage, visualError };
    }
  }
  return { facets, usage };
};
