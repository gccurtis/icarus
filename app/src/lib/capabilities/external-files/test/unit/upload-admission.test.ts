import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "vitest";

import type { UploadedExternalFile } from "$capabilities/external-files/types/external-files";
import {
  cleanupExternalFiles,
  prepareExternalFiles,
  readExternalFileLibrary,
  renameExternalFile,
  upload
} from "$capabilities/external-files/test/unit/external-files-fixture";

beforeEach(prepareExternalFiles);
afterEach(cleanupExternalFiles);

describe("External upload admission", () => {
  it("enforces upload size and count boundaries without partial rows", async () => {
    const empty = await upload([]);
    assert.equal(empty.uploaded, 0);
    assert.equal(empty.rejected, 1);
    assert.equal(empty.outcomes[0]?.status, "rejected");
    if (empty.outcomes[0]?.status === "rejected") {
      assert.equal(empty.outcomes[0].reason, "empty");
    }

    const tooMany = await upload(Array.from(
      { length: 11 },
      (_, index) => new File([String(index)], `many-${index}.txt`, { type: "text/plain" })
    ));
    assert.equal(tooMany.uploaded, 0);
    assert.equal(tooMany.rejected, 11);
    assert.ok(tooMany.outcomes.every(
      (outcome) => outcome.status === "rejected" && outcome.reason === "too-many-files"
    ));

    const tooLarge = await upload([
      new File([new Uint8Array(1_000_001)], "large.bin", {
        type: "application/octet-stream"
      })
    ]);
    assert.equal(tooLarge.rejected, 1);
    assert.equal(tooLarge.outcomes[0]?.status, "rejected");
    if (tooLarge.outcomes[0]?.status === "rejected") {
      assert.equal(tooLarge.outcomes[0].reason, "file-too-large");
    }

    const batch = await upload(Array.from(
      { length: 3 },
      (_, index) => new File([new Uint8Array(700_000)], `batch-${index}.bin`, {
        type: "application/octet-stream"
      })
    ));
    assert.equal(batch.uploaded, 0);
    assert.equal(batch.rejected, 3);
    assert.ok(batch.outcomes.every(
      (outcome) => outcome.status === "rejected" && outcome.reason === "batch-too-large"
    ));
    assert.equal((await readExternalFileLibrary()).files.length, 0);
  });

  it("allows duplicate leaf names in different directories and rejects invalid paths", async () => {
    const duplicated = await upload([
      new File(["north"], "report.txt", { type: "text/plain" }),
      new File(["south"], "report.txt", { type: "text/plain" })
    ], ["north/report.txt", "south/report.txt"]);
    assert.equal(duplicated.uploaded, 2);
    assert.deepEqual(
      (await readExternalFileLibrary()).files.map((file) => file.relativePath).sort(),
      ["north/report.txt", "south/report.txt"]
    );

    for (const relativePath of ["bad\nname.txt", " padded.txt", "folder\\path.txt"]) {
      const invalid = await upload([
        new File(["unsafe"], "unsafe.txt", { type: "text/plain" })
      ], [relativePath]);
      assert.equal(invalid.rejected, 1);
      assert.equal(invalid.outcomes[0].status, "rejected");
      if (invalid.outcomes[0].status === "rejected") {
        assert.equal(invalid.outcomes[0].reason, "invalid-path");
      }
    }

    await assert.rejects(() => renameExternalFile({
      externalFileId: duplicated.outcomes[0].status === "rejected"
        ? "externalFiles:missing"
        : duplicated.outcomes[0].externalFileId,
      baseRevision: 1,
      name: "bad\tname.txt"
    }), /control characters/);
  });

  it("stores native bytes, projects a scoped library, and makes retries idempotent", async () => {
    const note = new File(["Alpha facts"], "notes.md", { type: "text/markdown" });
    const image = new File([
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
    ], "map.bin", { type: "application/octet-stream" });
    const first = await upload([note, image], ["research/notes.md", "research/map.bin"]);

    assert.equal(first.uploaded, 2);
    assert.equal(first.rejected, 0);
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

    const conflict = await upload([
      new File(["Different"], "notes.md", { type: "text/markdown" })
    ], ["research/notes.md"]);
    assert.equal(conflict.rejected, 1);
    if (conflict.outcomes[0].status === "rejected") {
      assert.equal(conflict.outcomes[0].reason, "path-conflict");
    }
  });

  it("prevents a virtual path from being both a file and a directory", async () => {
    const batch = await upload([
      new File(["file"], "reports", { type: "application/octet-stream" }),
      new File(["nested"], "q1.txt", { type: "text/plain" })
    ], ["reports", "reports/q1.txt"]);
    assert.equal(batch.uploaded, 1);
    assert.equal(batch.rejected, 1);
    if (batch.outcomes[1].status === "rejected") {
      assert.equal(batch.outcomes[1].reason, "path-conflict");
    }

    const later = await upload([
      new File(["nested"], "q2.txt", { type: "text/plain" })
    ], ["reports/q2.txt"]);
    assert.equal(later.rejected, 1);
    if (later.outcomes[0].status === "rejected") {
      assert.equal(later.outcomes[0].reason, "path-conflict");
    }
  });
});
