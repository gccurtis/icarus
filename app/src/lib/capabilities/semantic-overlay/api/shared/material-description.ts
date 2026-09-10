import type { ServerModel } from "$runtime/server/start.server";
import type {
  GeneratedMaterialDescriptor,
  MaterialSeed
} from "$representation/data/types/semantic/material";
import { materialHash } from "$capabilities/semantic-overlay/api/shared/material-hash";

export const MATERIAL_DESCRIPTOR_PROMPT_VERSION = "semantic-material-v1";

const record = (value: unknown): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("material descriptor must be an object");
  }
  return value as Record<string, unknown>;
};

const strings = (value: unknown, label: string): string[] => {
  if (!Array.isArray(value) || value.length > 100 || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`material descriptor ${label} must be a bounded text array`);
  }
  return value.map((entry) => entry.trim()).filter(Boolean);
};

const parsedDescriptor = (value: unknown) => {
  const held = record(value);
  if (typeof held.summary !== "string" || !held.summary.trim()) {
    throw new Error("material descriptor summary must not be blank");
  }
  for (const key of ["purpose", "timeRange"] as const) {
    if (typeof held[key] !== "string") throw new Error(`material descriptor ${key} must be text`);
  }
  const purpose = held.purpose as string;
  const timeRange = held.timeRange as string;
  return {
    summary: held.summary.trim(),
    purpose: purpose.trim(),
    entities: strings(held.entities, "entities"),
    measures: strings(held.measures, "measures"),
    dimensions: strings(held.dimensions, "dimensions"),
    timeRange: timeRange.trim(),
    themes: strings(held.themes, "themes"),
    uncertainty: strings(held.uncertainty, "uncertainty")
  };
};

const descriptorSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    purpose: { type: "string" },
    entities: { type: "array", maxItems: 100, items: { type: "string" } },
    measures: { type: "array", maxItems: 100, items: { type: "string" } },
    dimensions: { type: "array", maxItems: 100, items: { type: "string" } },
    timeRange: { type: "string" },
    themes: { type: "array", maxItems: 100, items: { type: "string" } },
    uncertainty: { type: "array", maxItems: 100, items: { type: "string" } }
  },
  required: ["summary", "purpose", "entities", "measures", "dimensions", "timeRange", "themes", "uncertainty"],
  additionalProperties: false
} as const;

export const shouldDescribeMaterial = (seed: MaterialSeed): boolean => {
  if (seed.kind === "image") return seed.nativeImage !== undefined;
  if (seed.profile.kind === "table") return seed.profile.rows * seed.profile.columns >= 4;
  if (seed.profile.kind === "code") return seed.profile.lines >= 5;
  return true;
};

export const materialDescriptorModel = (model: ServerModel): string => {
  const value = model.configuration.get("intelligence.providers.openrouter.model");
  return typeof value === "string" && value.trim() ? value.trim() : "configured-intelligence-model";
};

const contextValue = (seed: MaterialSeed) => ({
  identity: { kind: seed.kind, name: seed.name },
  profile: seed.profile,
  authored: seed.context,
  sourceRevision: seed.source.kind === "externalFile"
    ? { hash: seed.source.hash }
    : seed.source.revision
});

export const materialDescriptorInputHash = (seed: MaterialSeed): string =>
  materialHash(contextValue(seed));

export const describeMaterial = async (
  model: ServerModel,
  seed: MaterialSeed,
  signal?: AbortSignal
): Promise<GeneratedMaterialDescriptor | undefined> => {
  signal?.throwIfAborted();
  if (model.configuration.get("semanticOverlay.materials.generateDescriptors") !== true) return undefined;
  if (!shouldDescribeMaterial(seed)) return undefined;
  const envelope = contextValue(seed);
  const inputHash = materialDescriptorInputHash(seed);
  const visual = seed.nativeImage;
  const result = await model.intelligence.completeWithTools({
    system: `You describe one project material for semantic discovery. Use only the supplied deterministic profile, authored context, and any original visual. State what the material contains and what questions it may answer. Do not invent values. Empty fields are allowed. Return the exact structured shape.`,
    user: visual === undefined
      ? `Material context:\n${JSON.stringify(envelope)}`
      : {
          text: `Material context:\n${JSON.stringify(envelope)}\nInspect the attached original image as well.`,
          images: [visual]
        },
    tools: [],
    output: {
      name: "semantic_material_descriptor",
      description: "A bounded discovery description with explicit uncertainty",
      schema: descriptorSchema,
      parse: parsedDescriptor
    },
    ...(signal === undefined ? {} : { signal })
  });
  const value = result.value;
  const sampled = seed.profile.kind === "csv" && seed.profile.truncated ||
    seed.profile.kind === "code" && seed.profile.truncated;
  return {
    summary: value.summary,
    ...(value.purpose ? { purpose: value.purpose } : {}),
    entities: value.entities,
    measures: value.measures,
    dimensions: value.dimensions,
    ...(value.timeRange ? { timeRange: value.timeRange } : {}),
    themes: value.themes,
    uncertainty: value.uncertainty,
    coverage: {
      mode: sampled ? "sampled" : "complete",
      description: sampled
        ? "Generated from a bounded deterministic profile and stratified sample."
        : "Generated from the complete bounded material profile."
    },
    model: materialDescriptorModel(model),
    promptVersion: MATERIAL_DESCRIPTOR_PROMPT_VERSION,
    inputHash,
    generatedAt: Date.now()
  };
};
