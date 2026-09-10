import type { Configuration } from "$model/server/configuration/index.server";
import { defineExternalFileStorage } from "$model/server/external-file-storage/definition";
import type {
  ExternalFileStorageFailpoint,
  ExternalFileStorageModel
} from "$model/server/external-file-storage/types";

const DIRECTORY = "externalFiles.storage.directory";

const requiredDirectory = (value: unknown, source: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${source} must be a non-empty string`);
  }
  return value.trim();
};

export const createExternalFileStorage = (
  configuration: Configuration,
  directoryOverride?: string,
  failpoint?: (point: ExternalFileStorageFailpoint) => void
): ExternalFileStorageModel => {
  const primary = directoryOverride === undefined
    ? requiredDirectory(configuration.get(DIRECTORY), `Configuration key '${DIRECTORY}'`)
    : requiredDirectory(directoryOverride, "External file storage directory override");
  return defineExternalFileStorage(primary, failpoint);
};
