import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { defineExternalFileStorage } from "$model/server/external-file-storage/index.server";
import { defineStore } from "$model/server/store/index.server";
import { asId } from "$representation/data/behavior/core/id";
import type { ServerModel } from "$runtime/server/start.server";

const runtime = vi.hoisted(() => ({
  scope: { projectId: "projects:local", userId: "users:local", username: "Local" },
  model: undefined as unknown as ServerModel
}));
vi.mock("$runtime/server/scope.server", () => ({ requireScope: async () => runtime.scope }));
vi.mock("$runtime/server/start.server", () => ({ serverModel: () => runtime.model }));

import { readExternalFile } from "$capabilities/external-files/api/read-external-file/read-external-file";
import { readExternalFileContent } from "$capabilities/external-files/api/read-external-file-content/read-external-file-content";
import { readExternalFileHistory } from "$capabilities/external-files/api/read-external-file-history/read-external-file-history";
import { readExternalFileLibrary } from "$capabilities/external-files/api/read-external-file-library/read-external-file-library";
import { relocateExternalDirectory } from "$capabilities/external-files/api/relocate-external-directory/relocate-external-directory";
import { relocateExternalFile } from "$capabilities/external-files/api/relocate-external-file/relocate-external-file";
import { removeExternalFile } from "$capabilities/external-files/api/remove-external-file/remove-external-file";
import { renameExternalFile } from "$capabilities/external-files/api/rename-external-file/rename-external-file";
import { reuploadExternalFile } from "$capabilities/external-files/api/reupload-external-file/reupload-external-file";
import { updateExternalFileContext } from "$capabilities/external-files/api/update-external-file-context/update-external-file-context";

let directory: string;
let foreignId: string;
const bytes = new TextEncoder().encode("foreign,private\n1,true\n");
const hash = createHash("sha256").update(bytes).digest("hex");
const limits: Record<string, number> = {
  "externalFiles.upload.maxFiles": 10,
  "externalFiles.upload.maxFileBytes": 1_000_000,
  "externalFiles.upload.maxBatchBytes": 2_000_000,
  "externalFiles.upload.maxPathBytes": 512,
  "externalFiles.download.maxResponseBytes": 1_000_000
};

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "icarus-external-ownership-"));
  const store = defineStore({});
  const externalFileStorage = defineExternalFileStorage(directory);
  const receipt = await externalFileStorage.put({
    storageId: asId<"_storage">(`_storage:${hash}`),
    hash,
    size: bytes.byteLength,
    bytes,
    maxBytes: bytes.byteLength
  });
  foreignId = store.create("externalFiles", {
    projectId: "projects:foreign",
    name: "private.csv",
    originalName: "private.csv",
    relativePath: "foreign/private.csv",
    mediaType: "text/csv",
    subkind: "data",
    storageId: `_storage:${hash}`,
    hash,
    size: bytes.byteLength,
    origin: { kind: "upload" },
    createdBy: { kind: "user", userId: "users:foreign" },
    updatedBy: { kind: "user", userId: "users:foreign" },
    semanticContext: "Foreign-only meaning",
    revision: 1,
    updatedAt: 1
  });
  await externalFileStorage.claimPublication(receipt, asId<"externalFiles">(foreignId));
  runtime.model = {
    store,
    externalFileStorage,
    configuration: { get: (key: string) => limits[key] }
  } as unknown as ServerModel;
});

afterEach(async () => rm(directory, { recursive: true, force: true }));

describe("cross-project External ownership", () => {
  test("reads reveal no foreign row, bytes, or lifecycle history", async () => {
    expect(await readExternalFileLibrary()).toMatchObject({ files: [], unavailable: [] });
    expect(await readExternalFile({ externalFileId: foreignId })).toBeNull();
    expect(await readExternalFileContent({ externalFileId: foreignId })).toBeNull();
    expect(await readExternalFileHistory()).toEqual({ entries: [] });
  });

  test("every target mutation resolves the subject inside request scope", async () => {
    const results = await Promise.all([
      renameExternalFile({ externalFileId: foreignId, baseRevision: 1, name: "stolen.csv" }),
      relocateExternalFile({
        externalFileId: foreignId,
        baseRevision: 1,
        destinationDirectory: "local"
      }),
      updateExternalFileContext({
        externalFileId: foreignId,
        baseRevision: 1,
        semanticContext: "Local overwrite"
      }),
      removeExternalFile({ externalFileId: foreignId, baseRevision: 1 }),
      reuploadExternalFile({
        id: "reupload",
        externalFileId: foreignId,
        baseRevision: 1,
        file: new File(["replacement"], "replacement.txt", { type: "text/plain" })
      }),
      relocateExternalDirectory({
        sourceDirectory: "foreign",
        destinationDirectory: "local",
        baseRevisionToken: "a".repeat(64)
      })
    ]);
    for (const result of results) {
      expect(result).toMatchObject({ accepted: false, reason: "not-found" });
    }

    const held = runtime.model.store.read(`externalFiles.${foreignId}`);
    expect(held?.kind === "row" ? held.row : undefined).toMatchObject({
      name: "private.csv",
      relativePath: "foreign/private.csv",
      semanticContext: "Foreign-only meaning",
      revision: 1
    });
    expect(await runtime.model.externalFileStorage.read({
      storageId: asId<"_storage">(`_storage:${hash}`),
      hash,
      size: bytes.byteLength
    })).toEqual(bytes);
  });
});
