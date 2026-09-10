import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

import { defineExternalFileStorage } from "$model/server/external-file-storage/index.server";
import { defineStore } from "$model/server/store/index.server";
import type { ServerModel } from "$runtime/server/start.server";
import type { UploadedExternalFile } from "$capabilities/external-files/types/external-files";
import {
  admitNativeFile,
  settleExternalPublicationAfterStoreFailure
} from "$capabilities/external-files/api/shared/native-file";

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

const { readExternalFile } = await import(
  "$capabilities/external-files/api/read-external-file/read-external-file"
);
const { readExternalFileContent } = await import(
  "$capabilities/external-files/api/read-external-file-content/read-external-file-content"
);
const { readExternalFileLibrary } = await import(
  "$capabilities/external-files/api/read-external-file-library/read-external-file-library"
);
const { readExternalFileHistory } = await import(
  "$capabilities/external-files/api/read-external-file-history/read-external-file-history"
);
const { relocateExternalDirectory } = await import(
  "$capabilities/external-files/api/relocate-external-directory/relocate-external-directory"
);
const { relocateExternalFile } = await import(
  "$capabilities/external-files/api/relocate-external-file/relocate-external-file"
);
const { removeExternalFile } = await import(
  "$capabilities/external-files/api/remove-external-file/remove-external-file"
);
const { renameExternalFile } = await import(
  "$capabilities/external-files/api/rename-external-file/rename-external-file"
);
const { reuploadExternalFile } = await import(
  "$capabilities/external-files/api/reupload-external-file/reupload-external-file"
);
const { updateExternalFileContext } = await import(
  "$capabilities/external-files/api/update-external-file-context/update-external-file-context"
);
const { uploadExternalFiles } = await import(
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

beforeEach(async () => {
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
});

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

const upload = (files: File[], relativePaths?: string[]) => uploadExternalFiles({
  id: "files",
  files,
  ...(relativePaths === undefined ? {} : { relativePaths })
});

describe("external file capability", () => {
  it("allows duplicate leaf names in different directories and rejects control characters", async () => {
    const duplicated = await upload([
      new File(["north"], "report.txt", { type: "text/plain" }),
      new File(["south"], "report.txt", { type: "text/plain" })
    ], ["north/report.txt", "south/report.txt"]);
    assert.equal(duplicated.uploaded, 2);
    assert.deepEqual(
      (await readExternalFileLibrary()).files.map((file) => file.relativePath).sort(),
      ["north/report.txt", "south/report.txt"]
    );

    const controlled = await upload([
      new File(["unsafe"], "bad\nname.txt", { type: "text/plain" })
    ]);
    assert.equal(controlled.rejected, 1);
    assert.equal(controlled.outcomes[0].status, "rejected");
    if (controlled.outcomes[0].status === "rejected") {
      assert.equal(controlled.outcomes[0].reason, "invalid-path");
    }
    const padded = await upload([
      new File(["unsafe"], "padded.txt", { type: "text/plain" })
    ], [" padded.txt"]);
    assert.equal(padded.rejected, 1);
    assert.equal(padded.outcomes[0].status, "rejected");
    if (padded.outcomes[0].status === "rejected") {
      assert.equal(padded.outcomes[0].reason, "invalid-path");
    }
    await assert.rejects(() => renameExternalFile({
      externalFileId: duplicated.outcomes[0].status === "rejected"
        ? "externalFiles:missing"
        : duplicated.outcomes[0].externalFileId,
      baseRevision: 1,
      name: "bad\tname.txt"
    }), /control characters/);
  });

  it("stores native bytes, projects a scoped library, and makes path retries idempotent", async () => {
    const note = new File(["Alpha facts"], "notes.md", { type: "text/markdown" });
    const image = new File([
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
    ], "map.bin", { type: "application/octet-stream" });
    const first = await upload([note, image], ["research/notes.md", "research/map.bin"]);

    assert.equal(first.uploaded, 2);
    assert.equal(first.rejected, 0);
    assert.deepEqual(first.outcomes.map((outcome) => outcome.status), ["uploaded", "uploaded"]);
    const uploaded = first.outcomes.filter(
      (outcome): outcome is UploadedExternalFile => outcome.status === "uploaded"
    );
    assert.deepEqual(uploaded.map((outcome) => outcome.semantic), ["queued", "queued"]);
    assert.equal(uploaded[0].subkind, "text");
    assert.equal(uploaded[1].mediaType, "image/png");
    assert.equal(uploaded[1].subkind, "image");

    const library = await readExternalFileLibrary();
    assert.equal(library.files.length, 2);
    assert.equal(library.files.find((file) => file.name === "notes.md")?.relativePath, "research/notes.md");
    assert.equal(library.files.find((file) => file.name === "notes.md")?.semantic.exact.state, "queued");
    assert.equal(library.files.find((file) => file.name === "notes.md")?.semantic.material.state, "unsupported");
    assert.equal(library.files.find((file) => file.name === "map.bin")?.semantic.material.state, "queued");
    assert.deepEqual(library.directories.map((directory) => directory.relativePath), ["", "research"]);

    const retried = await upload([note], ["research/notes.md"]);
    assert.equal(retried.reused, 1);
    assert.equal(retried.outcomes[0].status, "reused");
    assert.equal((await readExternalFileLibrary()).files.length, 2);

    const conflict = await upload([
      new File(["Different"], "notes.md", { type: "text/markdown" })
    ], ["research/notes.md"]);
    assert.equal(conflict.rejected, 1);
    assert.equal(conflict.outcomes[0].status, "rejected");
    if (conflict.outcomes[0].status === "rejected") {
      assert.equal(conflict.outcomes[0].reason, "path-conflict");
    }
  });

  it("renames metadata with compare-and-swap while preserving provenance and bytes", async () => {
    const created = await upload([
      new File(["const answer = 42;"], "answer.ts", { type: "text/typescript" })
    ], ["src/answer.ts"]);
    const outcome = created.outcomes[0];
    assert.notEqual(outcome.status, "rejected");
    if (outcome.status === "rejected") return;
    const before = await readExternalFile({ externalFileId: outcome.externalFileId });
    assert.ok(before !== null && !("unavailable" in before));
    if (before === null || "unavailable" in before) return;

    const changed = await renameExternalFile({
      externalFileId: before.id,
      baseRevision: before.revision,
      name: "pricing.ts"
    });
    assert.equal(changed.accepted, true);
    const after = await readExternalFile({ externalFileId: before.id });
    assert.ok(after !== null && !("unavailable" in after));
    if (after === null || "unavailable" in after) return;
    assert.equal(after.name, "pricing.ts");
    assert.equal(after.originalName, "answer.ts");
    assert.equal(after.relativePath, "src/pricing.ts");
    assert.equal(after.hash, before.hash);
    assert.deepEqual(await readExternalFileContent({ externalFileId: before.id }), {
      externalFileId: before.id,
      name: "pricing.ts",
      mediaType: "text/typescript",
      hash: before.hash,
      bytes: new TextEncoder().encode("const answer = 42;")
    });

    const stale = await renameExternalFile({
      externalFileId: before.id,
      baseRevision: before.revision,
      name: "Stale change"
    });
    assert.equal(stale.accepted, false);
    if (!stale.accepted) assert.equal(stale.reason, "stale");
  });

  it("refuses referenced deletion, then retires jobs and reclaims unshared bytes", async () => {
    const created = await upload([
      new File(["source"], "source.txt", { type: "text/plain" })
    ]);
    const outcome = created.outcomes[0];
    assert.notEqual(outcome.status, "rejected");
    if (outcome.status === "rejected") return;
    const fileId = outcome.externalFileId;
    const documentId = state.model.store.create("documents", {
      projectId: state.scope.projectId,
      title: "Uses source",
      createdBy: { kind: "system" },
      updatedBy: { kind: "system" },
      updatedAt: 1
    });
    const snapshotId = state.model.store.create("documentSnapshots", {
      projectId: state.scope.projectId,
      resourceId: documentId,
      revision: 0,
      role: "leader",
      part: 0,
      body: {
        rows: [{
          id: "row:1",
          kind: "blocks",
          blocks: [{ id: "image:1", type: "image", source: { kind: "file", fileId }, alt: "" }]
        }]
      },
      at: 1
    });
    const detail = await readExternalFile({ externalFileId: fileId });
    assert.ok(detail !== null && !("unavailable" in detail));
    if (detail === null || "unavailable" in detail) return;
    assert.equal(detail.usage.total, 1);

    const refused = await removeExternalFile({
      externalFileId: fileId,
      baseRevision: detail.revision
    });
    assert.equal(refused.accepted, false);
    if (!refused.accepted) assert.equal(refused.reason, "in-use");

    state.model.store.update(`documentSnapshots.${snapshotId}.body`, { rows: [] });
    const removed = await removeExternalFile({
      externalFileId: fileId,
      baseRevision: detail.revision
    });
    assert.equal(removed.accepted, true);
    if (removed.accepted) assert.equal(removed.blob, "removed");
    assert.equal(await readExternalFile({ externalFileId: fileId }), null);
    assert.equal(await readExternalFileContent({ externalFileId: fileId }), null);
    const jobs = state.model.store.read("semanticSyncJobs");
    assert.equal(jobs?.kind === "table" ? jobs.rows.length : -1, 1);
    if (jobs?.kind === "table" && jobs.table === "semanticSyncJobs") {
      assert.equal(jobs.rows[0].requestedRevision, 2);
    }
  });

  it("keeps foreign project rows outside list and detail reads", async () => {
    const bytes = new TextEncoder().encode("foreign");
    const native = admitNativeFile(bytes, "text/plain", "foreign.txt");
    const receipt = await state.model.externalFileStorage.put({ ...native, bytes });
    const foreignId = state.model.store.create("externalFiles", {
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
    await state.model.externalFileStorage.claimPublication(receipt, foreignId);

    assert.equal((await readExternalFileLibrary()).files.length, 0);
    assert.equal(await readExternalFile({ externalFileId: foreignId }), null);
  });

  it("shares equal native bytes across distinct paths and reclaims them only after the last row", async () => {
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
    assert.ok(firstDetail !== null && !("unavailable" in firstDetail));
    assert.ok(secondDetail !== null && !("unavailable" in secondDetail));
    if (
      firstDetail === null ||
      secondDetail === null ||
      "unavailable" in firstDetail ||
      "unavailable" in secondDetail
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

  it("claims an ambiguously committed publication for every row sharing its bytes", async () => {
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
    const storage = state.model.externalFileStorage;
    const receipt = await storage.put({ ...native, bytes });
    const claimed: string[] = [];
    state.model = {
      ...state.model,
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

    await settleExternalPublicationAfterStoreFailure(state.model, receipt);
    assert.deepEqual(
      new Set(claimed),
      new Set([firstOutcome.externalFileId, secondOutcome.externalFileId])
    );
  });

  it("reports native storage failure for one candidate without creating a row", async () => {
    const held = state.model.externalFileStorage;
    state.model = {
      ...state.model,
      externalFileStorage: {
        acquireMutation: held.acquireMutation,
        put: async () => {
          throw new Error("disk unavailable");
        },
        claimPublication: held.claimPublication,
        discardPublication: held.discardPublication,
        releaseClaim: held.releaseClaim,
        read: held.read,
        remove: held.remove,
        reconcile: held.reconcile
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

  it("re-uploads in place, retires the old blob, and records durable history", async () => {
    const created = await upload([
      new File(["export const version = 1;"], "module.ts", { type: "text/typescript" })
    ], ["src/module.ts"]);
    const outcome = created.outcomes[0];
    assert.notEqual(outcome.status, "rejected");
    if (outcome.status === "rejected") return;
    const before = await readExternalFile({ externalFileId: outcome.externalFileId });
    assert.ok(before !== null && !("unavailable" in before));
    if (before === null || "unavailable" in before) return;

    const replaced = await reuploadExternalFile({
      id: "reupload",
      externalFileId: before.id,
      baseRevision: before.revision,
      file: new File(["export const version = 2;"], "replacement.ts", { type: "text/typescript" })
    });
    assert.equal(replaced.accepted, true);
    if (!replaced.accepted) return;
    assert.equal(replaced.externalFileId, before.id);
    assert.equal(replaced.revision, before.revision + 1);
    assert.equal(replaced.previousBlob, "removed");
    assert.equal(replaced.subkind, "code");
    const after = await readExternalFile({ externalFileId: before.id });
    assert.ok(after !== null && !("unavailable" in after));
    if (after === null || "unavailable" in after) return;
    assert.equal(after.name, "module.ts");
    assert.equal(after.relativePath, "src/module.ts");
    assert.notEqual(after.hash, before.hash);
    assert.equal(
      new TextDecoder().decode((await readExternalFileContent({ externalFileId: before.id }))?.bytes),
      "export const version = 2;"
    );
    assert.deepEqual(
      (await readExternalFileHistory()).entries.map((entry) => entry.event),
      ["re-uploaded", "uploaded"]
    );
  });

  it("moves files and whole virtual directories with collision-safe revisions", async () => {
    const created = await upload([
      new File(["a,b\n1,2"], "one.csv", { type: "text/csv" }),
      new File(["export const two = 2"], "two.ts", { type: "text/typescript" })
    ], ["source/data/one.csv", "source/code/two.ts"]);
    const first = created.outcomes[0];
    assert.notEqual(first.status, "rejected");
    if (first.status === "rejected") return;
    const detail = await readExternalFile({ externalFileId: first.externalFileId });
    assert.ok(detail !== null && !("unavailable" in detail));
    if (detail === null || "unavailable" in detail) return;
    const moved = await relocateExternalFile({
      externalFileId: detail.id,
      baseRevision: detail.revision,
      destinationDirectory: "source/archive"
    });
    assert.equal(moved.accepted, true);

    const library = await readExternalFileLibrary();
    const source = library.directories.find((directory) => directory.relativePath === "source");
    assert.ok(source !== undefined);
    const relocated = await relocateExternalDirectory({
      sourceDirectory: "source",
      destinationDirectory: "archive/2026",
      baseRevisionToken: source.revisionToken
    });
    assert.equal(relocated.accepted, true);
    if (!relocated.accepted) return;
    assert.equal(relocated.movedFiles, 2);
    assert.deepEqual(
      (await readExternalFileLibrary()).files.map((file) => file.relativePath).sort(),
      ["archive/2026/archive/one.csv", "archive/2026/code/two.ts"]
    );
  });

  it("stores optional dataset context as authored material input", async () => {
    const created = await upload([
      new File(["account,value\nA,10"], "ledger.csv", { type: "text/csv" })
    ]);
    const outcome = created.outcomes[0];
    assert.notEqual(outcome.status, "rejected");
    if (outcome.status === "rejected") return;
    const before = await readExternalFile({ externalFileId: outcome.externalFileId });
    assert.ok(before !== null && !("unavailable" in before));
    if (before === null || "unavailable" in before) return;
    const changed = await updateExternalFileContext({
      externalFileId: before.id,
      baseRevision: before.revision,
      semanticContext: "Monthly invoiced value in US dollars; test accounts are excluded."
    });
    assert.equal(changed.accepted, true);
    const after = await readExternalFile({ externalFileId: before.id });
    assert.ok(after !== null && !("unavailable" in after));
    if (after === null || "unavailable" in after) return;
    assert.equal(after.semanticContext, "Monthly invoiced value in US dollars; test accounts are excluded.");
    assert.equal((await readExternalFileHistory()).entries[0].event, "context-updated");
  });

  it("refuses dataset context on a non-data file", async () => {
    const created = await upload([
      new File(["export const value = 1;"], "value.ts", { type: "text/typescript" })
    ]);
    const outcome = created.outcomes[0];
    assert.notEqual(outcome.status, "rejected");
    if (outcome.status === "rejected") return;
    const result = await updateExternalFileContext({
      externalFileId: outcome.externalFileId,
      baseRevision: outcome.revision,
      semanticContext: "This must not become code metadata."
    });
    assert.equal(result.accepted, false);
    if (!result.accepted) assert.equal(result.reason, "wrong-kind");
  });
});
