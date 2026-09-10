import type { Configuration } from "$model/server/configuration/index.server";
import { defineExternalFileStorage } from "$model/server/external-file-storage/definition";
import type {
  ExternalFileStorageFailpoint,
  ExternalFileStorageModel
} from "$model/server/external-file-storage/types";

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
  directoryOverride?: string,
  failpoint?: (point: ExternalFileStorageFailpoint) => void
): ExternalFileStorageModel => {
  const primary = directoryOverride?.trim() || configuredDirectory(
    configuration,
    "externalFiles.storage.directory",
    "data/external-files"
  );
  return defineExternalFileStorage(primary, failpoint);
};
