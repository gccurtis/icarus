import {
  requiredString,
  type Configuration
} from "$model/server/configuration/index.server";
import { validateRecursiveIndexConfiguration } from "$representation/data/behavior/semantic/recursive-index";
import type { RecursiveIndexConfiguration } from "$representation/data/types/semantic/index";
import type { TranslationConfiguration } from "$representation/data/types/semantic/translation";

const INDEX = "semanticOverlay.index";
const TRANSLATION = "semanticOverlay.translation";
const MATERIALS = "semanticOverlay.materials";
const DESCRIPTOR_MODEL = "intelligence.providers.openrouter.model";

const requiredNumber = (configuration: Configuration, root: string, key: string): number => {
  const path = `${root}.${key}`;
  const value = configuration.get(path);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Configuration key '${path}' must be a finite number`);
  }
  return value;
};

export const semanticIndexConfiguration = (
  configuration: Configuration
): RecursiveIndexConfiguration => {
  const value = {
    branchFactor: requiredNumber(configuration, INDEX, "branchFactor"),
    leafSize: requiredNumber(configuration, INDEX, "leafSize"),
    maxIterations: requiredNumber(configuration, INDEX, "maxIterations"),
    convergenceTolerance: requiredNumber(configuration, INDEX, "convergenceTolerance"),
    candidateMultiplier: requiredNumber(configuration, INDEX, "candidateMultiplier")
  };
  validateRecursiveIndexConfiguration(value);
  return value;
};

/** Reads the deterministic translation policy owned by the Semantic Overlay. */
export const semanticTranslationConfiguration = (
  configuration: Configuration
): TranslationConfiguration => ({
  maxTokens: requiredNumber(configuration, TRANSLATION, "maxTokens"),
  minTokens: requiredNumber(configuration, TRANSLATION, "minTokens"),
  changeThreshold: requiredNumber(configuration, TRANSLATION, "changeThreshold"),
  basinProminenceThreshold: requiredNumber(
    configuration,
    TRANSLATION,
    "basinProminenceThreshold"
  ),
  basinMassFraction: requiredNumber(configuration, TRANSLATION, "basinMassFraction"),
  attractionDecayTokens: requiredNumber(
    configuration,
    TRANSLATION,
    "attractionDecayTokens"
  ),
  attractionStationaryThreshold: requiredNumber(
    configuration,
    TRANSLATION,
    "attractionStationaryThreshold"
  )
});

/** Exact upper bound for ephemeral native image bytes sent to semantic providers. */
export const semanticMaximumNativeImageBytes = (configuration: Configuration): number => {
  const value = requiredNumber(configuration, MATERIALS, "maxNativeImageBytes");
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(
      "Configuration key 'semanticOverlay.materials.maxNativeImageBytes' must be a positive safe integer"
    );
  }
  return value;
};

/** Whether generated material descriptions are part of the exact current policy. */
export const semanticMaterialDescriptorsEnabled = (
  configuration: Configuration
): boolean => {
  const path = `${MATERIALS}.generateDescriptors`;
  const value = configuration.get(path);
  if (typeof value !== "boolean") {
    throw new Error(`Configuration key '${path}' must be a boolean`);
  }
  return value;
};

/** The configured provider model recorded on every generated material description. */
export const semanticMaterialDescriptorModel = (
  configuration: Configuration
): string => requiredString(configuration, DESCRIPTOR_MODEL);
