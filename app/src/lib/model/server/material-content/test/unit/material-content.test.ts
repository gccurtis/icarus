import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "vitest";

import { defineMaterialContent } from "$model/server/material-content/definition";
import type { Id } from "$representation/data/types/core/id";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map(async (directory) => {
    await rm(directory, { recursive: true, force: true });
  }));
});

describe("native semantic material content", () => {
  it("reads only a content-addressed value whose bytes match its SHA-256 name", async () => {
    const directory = await mkdtemp(join(tmpdir(), "icarus-material-content-"));
    directories.push(directory);
    const bytes = new TextEncoder().encode("region,revenue\nNorth,120\n");
    const hash = createHash("sha256").update(bytes).digest("hex");
    await writeFile(join(directory, hash), bytes);
    const content = defineMaterialContent(directory);

    assert.deepEqual(
      await content.read({ storageId: "_storage:test" as Id<"_storage">, hash }),
      bytes
    );
    assert.equal(
      await content.read({ storageId: "_storage:missing" as Id<"_storage">, hash: "b".repeat(64) }),
      undefined
    );
    await assert.rejects(
      () => content.read({ storageId: "_storage:escape" as Id<"_storage">, hash: "../outside" }),
      /must be SHA-256/
    );
  });

  it("rejects corrupt bytes even when a file is stored under a valid digest name", async () => {
    const directory = await mkdtemp(join(tmpdir(), "icarus-material-content-"));
    directories.push(directory);
    const claimed = "c".repeat(64);
    await writeFile(join(directory, claimed), "different bytes");

    await assert.rejects(
      () => defineMaterialContent(directory).read({
        storageId: "_storage:corrupt" as Id<"_storage">,
        hash: claimed
      }),
      /does not match/
    );
  });

  it("atomically publishes bounded bytes and reuses their stable address", async () => {
    const directory = await mkdtemp(join(tmpdir(), "icarus-material-content-"));
    directories.push(directory);
    const content = defineMaterialContent(directory);
    const bytes = new TextEncoder().encode("stable native bytes");
    const hash = createHash("sha256").update(bytes).digest("hex");

    const created = await content.put({ bytes, maxBytes: bytes.byteLength });
    assert.deepEqual(created, {
      storageId: `_storage:${hash}`,
      hash,
      size: bytes.byteLength,
      reused: false
    });
    assert.deepEqual(await content.read(created), bytes);

    const reused = await content.put({ bytes, maxBytes: bytes.byteLength });
    assert.equal(reused.reused, true);
    assert.equal(reused.storageId, created.storageId);
    assert.equal(reused.hash, created.hash);
  });

  it("enforces the caller ceiling and removes an addressed value idempotently", async () => {
    const directory = await mkdtemp(join(tmpdir(), "icarus-material-content-"));
    directories.push(directory);
    const content = defineMaterialContent(directory);
    const bytes = new TextEncoder().encode("too large");

    await assert.rejects(() => content.put({ bytes, maxBytes: 3 }), /exceeds the 3 byte limit/);
    const created = await content.put({ bytes });
    assert.equal(await content.remove(created), true);
    assert.equal(await content.remove(created), false);
    assert.equal(await content.read(created), undefined);
  });

  it("serializes represented-row and native-content mutation leases", async () => {
    const directory = await mkdtemp(join(tmpdir(), "icarus-material-content-"));
    directories.push(directory);
    const content = defineMaterialContent(directory);
    const releaseFirst = await content.acquireMutation();
    let secondEntered = false;
    const second = content.acquireMutation().then((release) => {
      secondEntered = true;
      release();
    });

    await Promise.resolve();
    assert.equal(secondEntered, false);
    releaseFirst();
    await second;
    assert.equal(secondEntered, true);
  });
});
