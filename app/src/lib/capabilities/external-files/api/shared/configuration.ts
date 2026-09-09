import type { Configuration } from "$model/server/configuration/index.server";
import type { ExternalFilesLimits } from "$capabilities/external-files/types/external-files";

const positiveInteger = (configuration: Configuration, key: string): number => {
  const value = configuration.get(key);
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new Error(`Configuration key '${key}' must be a positive safe integer`);
  }
  return value as number;
};

export const externalFilesLimits = (configuration: Configuration): ExternalFilesLimits => ({
  maxFiles: positiveInteger(configuration, "externalFiles.upload.maxFiles"),
  maxFileBytes: positiveInteger(configuration, "externalFiles.upload.maxFileBytes"),
  maxBatchBytes: positiveInteger(configuration, "externalFiles.upload.maxBatchBytes"),
  maxPathBytes: positiveInteger(configuration, "externalFiles.upload.maxPathBytes"),
  maxResponseBytes: positiveInteger(configuration, "externalFiles.download.maxResponseBytes")
});
