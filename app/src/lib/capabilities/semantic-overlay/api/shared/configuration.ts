import type { Configuration } from "$model/server/configuration/index.server";
import { validateRecursiveIndexConfiguration } from "$representation/data/behavior/semantic/recursive-index";
import type { RecursiveIndexConfiguration } from "$representation/data/types/semantic/index";

const ROOT = "semanticOverlay.index";

const requiredNumber = (configuration: Configuration, key: string): number => {
  const value = configuration.get(`${ROOT}.${key}`);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Configuration key '${ROOT}.${key}' must be a finite number`);
  }
  return value;
};

export const semanticIndexConfiguration = (
  configuration: Configuration
): RecursiveIndexConfiguration => {
  const value = {
    branchFactor: requiredNumber(configuration, "branchFactor"),
    leafSize: requiredNumber(configuration, "leafSize"),
    maxIterations: requiredNumber(configuration, "maxIterations"),
    convergenceTolerance: requiredNumber(configuration, "convergenceTolerance"),
    candidateMultiplier: requiredNumber(configuration, "candidateMultiplier")
  };
  validateRecursiveIndexConfiguration(value);
  return value;
};
