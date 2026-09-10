import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vi } from "vitest";

import { defineExternalFileStorage } from "$model/server/external-file-storage/index.server";
import { defineStore } from "$model/server/store/index.server";
import type { ServerModel } from "$runtime/server/start.server";

const state = vi.hoisted(() => ({
  scope: { projectId: "projects:external", userId: "users:ana", username: "Ana" },
  model: undefined as unknown as ServerModel
}));

vi.mock("$runtime/server/scope.server", () => ({
  requireScope: async () => state.scope
}));
vi.mock("$runtime/server/start.server", () => ({
  serverModel: () => state.model
}));

export const externalFilesState = () => state;

export const { readExternalFile } = await import(
  "$capabilities/external-files/api/read-external-file/read-external-file"
);
export const { readExternalFileContent } = await import(
  "$capabilities/external-files/api/read-external-file-content/read-external-file-content"
);
export const { readExternalFileLibrary } = await import(
  "$capabilities/external-files/api/read-external-file-library/read-external-file-library"
);
export const { readExternalFileHistory } = await import(
  "$capabilities/external-files/api/read-external-file-history/read-external-file-history"
);
export const { relocateExternalDirectory } = await import(
  "$capabilities/external-files/api/relocate-external-directory/relocate-external-directory"
);
export const { relocateExternalFile } = await import(
  "$capabilities/external-files/api/relocate-external-file/relocate-external-file"
);
export const { removeExternalFile } = await import(
  "$capabilities/external-files/api/remove-external-file/remove-external-file"
);
export const { renameExternalFile } = await import(
  "$capabilities/external-files/api/rename-external-file/rename-external-file"
);
export const { reuploadExternalFile } = await import(
  "$capabilities/external-files/api/reupload-external-file/reupload-external-file"
);
export const { updateExternalFileContext } = await import(
  "$capabilities/external-files/api/update-external-file-context/update-external-file-context"
);
export const { uploadExternalFiles } = await import(
  "$capabilities/external-files/api/upload-external-files/upload-external-files"
);

const directories: string[] = [];
const limits: Record<string, number> = {
  "externalFiles.upload.maxFiles": 10,
  "externalFiles.upload.maxFileBytes": 1_000_000,
  "externalFiles.upload.maxBatchBytes": 2_000_000,
  "externalFiles.upload.maxPathBytes": 512,
  "externalFiles.download.maxResponseBytes": 1_000_000,
  "semanticOverlay.index.branchFactor": 3,
  "semanticOverlay.index.leafSize": 2,
  "semanticOverlay.index.maxIterations": 12,
  "semanticOverlay.index.convergenceTolerance": 0.0001,
  "semanticOverlay.index.candidateMultiplier": 2
};

export const prepareExternalFiles = async () => {
  const directory = await mkdtemp(join(tmpdir(), "icarus-external-files-"));
  directories.push(directory);
  let at = 100;
  state.model = {
    store: defineStore({ now: () => (at += 1) }),
    externalFileStorage: defineExternalFileStorage(join(directory, "external-files")),
    configuration: { get: (key: string) => limits[key] },
    embedding: {
      space: { provider: "jina", model: "test", dimensions: 2 },
      query: async () => {
        throw new Error("semantic processing is not part of upload");
      },
      documents: async () => {
        throw new Error("semantic processing is not part of upload");
      }
    },
    observability: { logger: { info: () => undefined } }
  } as unknown as ServerModel;
};

export const cleanupExternalFiles = async () => {
  await Promise.all(directories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
};

export const upload = (files: File[], relativePaths?: string[]) => uploadExternalFiles({
  id: "files",
  files,
  ...(relativePaths === undefined ? {} : { relativePaths })
});
