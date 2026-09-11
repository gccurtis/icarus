import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "vitest";

import {
  cleanupExternalFiles,
  externalFilesState,
  prepareExternalFiles,
  readExternalFile,
  readExternalFileContent,
  readExternalFileLibrary,
  relocateExternalDirectory,
  relocateExternalFile,
  removeExternalFile,
  renameExternalFile,
  upload
} from "$capabilities/external-files/test/unit/external-files-fixture";

beforeEach(prepareExternalFiles);
afterEach(cleanupExternalFiles);

describe("External file mutations", () => {
  it("renames metadata with compare-and-swap while preserving provenance and bytes", async () => {
    const created = await upload([
      new File(["const answer = 42;"], "answer.ts", { type: "text/typescript" })
    ], ["src/answer.ts"]);
    const outcome = created.outcomes[0];
    assert.notEqual(outcome.status, "rejected");
    if (outcome.status === "rejected") return;
    const before = await readExternalFile({ externalFileId: outcome.externalFileId });
    assert.ok(before !== null);
    if (before === null) return;

    const changed = await renameExternalFile({
      externalFileId: before.id,
      baseRevision: before.revision,
      name: "pricing.ts"
    });
    assert.equal(changed.accepted, true);
    const after = await readExternalFile({ externalFileId: before.id });
    assert.ok(after !== null);
    if (after === null) return;
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

  it("refuses referenced deletion, then retires jobs and reclaims bytes", async () => {
    const created = await upload([new File(["source"], "source.txt", { type: "text/plain" })]);
    const outcome = created.outcomes[0];
    assert.notEqual(outcome.status, "rejected");
    if (outcome.status === "rejected") return;
    const fileId = outcome.externalFileId;
    const documentId = externalFilesState().model.store.create("documents", {
      projectId: externalFilesState().scope.projectId,
      title: "Uses source",
      createdBy: { kind: "system" },
      updatedBy: { kind: "system" },
      updatedAt: 1
    });
    const snapshotId = externalFilesState().model.store.create("documentSnapshots", {
      projectId: externalFilesState().scope.projectId,
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
    assert.ok(detail !== null);
    if (detail === null) return;
    assert.equal(detail.usage.total, 1);

    const refused = await removeExternalFile({
      externalFileId: fileId,
      baseRevision: detail.revision
    });
    assert.equal(refused.accepted, false);
    if (!refused.accepted) assert.equal(refused.reason, "in-use");

    externalFilesState().model.store.update(`documentSnapshots.${snapshotId}.body`, { rows: [] });
    const removed = await removeExternalFile({
      externalFileId: fileId,
      baseRevision: detail.revision
    });
    assert.equal(removed.accepted, true);
    if (removed.accepted) assert.equal(removed.blob, "removed");
    assert.equal(await readExternalFile({ externalFileId: fileId }), null);
    assert.equal(await readExternalFileContent({ externalFileId: fileId }), null);
    const jobs = externalFilesState().model.store.read("semanticSyncJobs");
    assert.equal(jobs?.kind === "table" ? jobs.rows.length : -1, 1);
    if (jobs?.kind === "table" && jobs.table === "semanticSyncJobs") {
      assert.equal(jobs.rows[0].requestedRevision, 2);
    }
  });

  it("moves files and virtual directories with collision-safe revisions", async () => {
    const created = await upload([
      new File(["a,b\n1,2"], "one.csv", { type: "text/csv" }),
      new File(["export const two = 2"], "two.ts", { type: "text/typescript" })
    ], ["source/data/one.csv", "source/code/two.ts"]);
    const first = created.outcomes[0];
    assert.notEqual(first.status, "rejected");
    if (first.status === "rejected") return;
    const detail = await readExternalFile({ externalFileId: first.externalFileId });
    assert.ok(detail !== null);
    if (detail === null) return;
    const moved = await relocateExternalFile({
      externalFileId: detail.id,
      baseRevision: detail.revision,
      destinationDirectory: "source/archive"
    });
    assert.equal(moved.accepted, true);

    const source = (await readExternalFileLibrary()).directories.find(
      (directory) => directory.relativePath === "source"
    );
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
});
