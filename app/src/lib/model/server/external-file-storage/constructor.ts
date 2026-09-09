import type { Configuration } from "$model/server/configuration/index.server";
import { defineExternalFileStorage } from "$model/server/external-file-storage/definition";
import type { ExternalFileStorageModel } from "$model/server/external-file-storage/types";

const configuredDirectory = (
  configuration: Configuration,
  key: string,
  fallback: string
): string => {
  const value = configuration.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
};

export const createExternalFileStorage = (
  configuration: Configuration,
  directoryOverride?: string
): ExternalFileStorageModel => {
  const primary = directoryOverride?.trim() || configuredDirectory(
    configuration,
    "externalFiles.storage.directory",
    "data/external-files"
  );
  const legacy = configuredDirectory(
    configuration,
    "externalFiles.storage.legacyDirectory",
    configuredDirectory(configuration, "representation.materials.directory", "data/materials")
  );
  return defineExternalFileStorage(primary, [legacy]);
};
