import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "vitest";

import type { ServerModel } from "$runtime/server/start.server";
import {
  admitNativeFile,
  settleExternalPublicationAfterStoreFailure
} from "$capabilities/external-files/api/shared/native-file";
import {
  cleanupExternalFiles,
  externalFilesState,
  prepareExternalFiles,
  readExternalFile,
  readExternalFileContent,
  readExternalFileLibrary,
  removeExternalFile,
  upload
} from "$capabilities/external-files/test/unit/external-files-fixture";

beforeEach(prepareExternalFiles);
afterEach(cleanupExternalFiles);

describe("External native storage lifecycle", () => {
  it("keeps foreign-project rows outside list and detail reads", async () => {
    const bytes = new TextEncoder().encode("foreign");
    const native = admitNativeFile(bytes, "text/plain", "foreign.txt");
    const receipt = await externalFilesState().model.externalFileStorage.put({
      storageId: native.storageId,
      hash: native.hash,
      size: native.size,
      bytes,
      maxBytes: bytes.byteLength
    });
    const foreignId = externalFilesState().model.store.create("externalFiles", {
      projectId: "projects:foreign",
      name: "foreign.txt",
      originalName: "foreign.txt",
      relativePath: "foreign.txt",
      mediaType: "text/plain",
      subkind: "text",
      storageId: receipt.storageId,
      hash: receipt.hash,
      size: receipt.size,
      origin: { kind: "upload" },
      createdBy: { kind: "system" },
      updatedBy: { kind: "system" },
      revision: 1,
      updatedAt: 1
    });
    await externalFilesState().model.externalFileStorage.claimPublication(receipt, foreignId);

    assert.equal((await readExternalFileLibrary()).files.length, 0);
    assert.equal(await readExternalFile({ externalFileId: foreignId }), null);
  });

  it("shares equal bytes across paths and reclaims them after the last row", async () => {
    const bytes = "one immutable body";
    const first = await upload([new File([bytes], "first.txt", { type: "text/plain" })]);
    const second = await upload([new File([bytes], "second.txt", { type: "text/plain" })]);
    const firstOutcome = first.outcomes[0];
    const secondOutcome = second.outcomes[0];
    assert.notEqual(firstOutcome.status, "rejected");
    assert.notEqual(secondOutcome.status, "rejected");
    if (firstOutcome.status === "rejected" || secondOutcome.status === "rejected") return;

    const firstDetail = await readExternalFile({ externalFileId: firstOutcome.externalFileId });
    const secondDetail = await readExternalFile({ externalFileId: secondOutcome.externalFileId });
    assert.ok(firstDetail !== null);
    assert.ok(secondDetail !== null);
    if (
      firstDetail === null ||
      secondDetail === null
    ) return;
    assert.equal(firstDetail.hash, secondDetail.hash);

    const firstRemoved = await removeExternalFile({
      externalFileId: firstDetail.id,
      baseRevision: firstDetail.revision
    });
    assert.equal(firstRemoved.accepted, true);
    if (firstRemoved.accepted) assert.equal(firstRemoved.blob, "shared");
    const secondContent = await readExternalFileContent({ externalFileId: secondDetail.id });
    assert.notEqual(secondContent, null);
    if (secondContent === null) return;
    assert.equal(new TextDecoder().decode(secondContent.bytes), bytes);

    const secondRemoved = await removeExternalFile({
      externalFileId: secondDetail.id,
      baseRevision: secondDetail.revision
    });
    assert.equal(secondRemoved.accepted, true);
    if (secondRemoved.accepted) assert.equal(secondRemoved.blob, "removed");
  });

  it("claims an ambiguous publication for every row sharing its bytes", async () => {
    const body = "shared recovery body";
    const first = await upload([new File([body], "first.txt", { type: "text/plain" })]);
    const second = await upload([new File([body], "second.txt", { type: "text/plain" })]);
    const firstOutcome = first.outcomes[0];
    const secondOutcome = second.outcomes[0];
    assert.notEqual(firstOutcome.status, "rejected");
    assert.notEqual(secondOutcome.status, "rejected");
    if (firstOutcome.status === "rejected" || secondOutcome.status === "rejected") return;

    const bytes = new TextEncoder().encode(body);
    const native = admitNativeFile(bytes, "text/plain", "recovered.txt");
    const storage = externalFilesState().model.externalFileStorage;
    const receipt = await storage.put({
      storageId: native.storageId,
      hash: native.hash,
      size: native.size,
      bytes,
      maxBytes: bytes.byteLength
    });
    const claimed: string[] = [];
    externalFilesState().model = {
      ...externalFilesState().model,
      externalFileStorage: {
        ...storage,
        claimPublication: async (
          publication: Parameters<typeof storage.claimPublication>[0],
          ownerId: Parameters<typeof storage.claimPublication>[1]
        ) => {
          claimed.push(ownerId);
          await storage.claimPublication(publication, ownerId);
        }
      }
    } as unknown as ServerModel;

    await settleExternalPublicationAfterStoreFailure(externalFilesState().model, receipt);
    assert.deepEqual(
      new Set(claimed),
      new Set([firstOutcome.externalFileId, secondOutcome.externalFileId])
    );
  });

  it("reports native storage failure without creating a row", async () => {
    const held = externalFilesState().model.externalFileStorage;
    externalFilesState().model = {
      ...externalFilesState().model,
      externalFileStorage: {
        ...held,
        put: async () => {
          throw new Error("disk unavailable");
        }
      }
    } as unknown as ServerModel;

    const result = await upload([new File(["body"], "failed.txt", { type: "text/plain" })]);
    assert.equal(result.rejected, 1);
    assert.equal(result.outcomes[0].status, "rejected");
    if (result.outcomes[0].status === "rejected") {
      assert.equal(result.outcomes[0].reason, "storage-failed");
      assert.match(result.outcomes[0].detail, /disk unavailable/);
    }
    assert.equal((await readExternalFileLibrary()).files.length, 0);
  });
});
