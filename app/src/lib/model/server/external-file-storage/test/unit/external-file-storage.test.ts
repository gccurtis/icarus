import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "vitest";

import { defineExternalFileStorage } from "$model/server/external-file-storage/definition";
import type { Id } from "$representation/data/types/core/id";

const directories: string[] = [];
const location = async (label: string): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), label));
  directories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(directories.splice(0).map(async (directory) => {
    await rm(directory, { recursive: true, force: true });
  }));
});

const descriptor = (bytes: Uint8Array) => {
  const hash = createHash("sha256").update(bytes).digest("hex");
  return {
    storageId: `_storage:${hash}` as Id<"_storage">,
    hash,
    size: bytes.byteLength
  };
};

describe("External native-file storage", () => {
  it("accepts an External-derived descriptor and verifies it on write and read", async () => {
    const storage = defineExternalFileStorage(await location("icarus-external-storage-"));
    const bytes = new TextEncoder().encode("region,revenue\nNorth,120\n");
    const ref = descriptor(bytes);

    assert.deepEqual(await storage.put({ ...ref, bytes, maxBytes: bytes.byteLength }), {
      ...ref,
      reused: false
    });
    assert.deepEqual(await storage.read(ref), bytes);
    assert.equal((await storage.put({ ...ref, bytes })).reused, true);
    await assert.rejects(
      () => storage.put({ ...ref, hash: "b".repeat(64), bytes }),
      /admitted SHA-256/
    );
    await assert.rejects(
      () => storage.put({ ...ref, size: ref.size + 1, bytes }),
      /admitted size/
    );
  });

  it("reads legacy bytes while publishing new content only to the primary repository", async () => {
    const primary = await location("icarus-external-primary-");
    const legacy = await location("icarus-external-legacy-");
    const bytes = new TextEncoder().encode("legacy file");
    const ref = descriptor(bytes);
    await writeFile(join(legacy, ref.hash), bytes);
    const storage = defineExternalFileStorage(primary, [legacy]);

    assert.deepEqual(await storage.read(ref), bytes);
    assert.equal((await storage.put({ ...ref, bytes })).reused, true);
    assert.equal(await storage.remove(ref), true);
    assert.equal(await storage.read(ref), undefined);
  });

  it("rejects corrupt or size-mismatched stored bytes", async () => {
    const directory = await location("icarus-external-storage-");
    const bytes = new TextEncoder().encode("expected");
    const ref = descriptor(bytes);
    await writeFile(join(directory, ref.hash), "different");
    const storage = defineExternalFileStorage(directory);

    await assert.rejects(() => storage.read(ref), /SHA-256/);
    await rm(join(directory, ref.hash));
    await writeFile(join(directory, ref.hash), bytes);
    await assert.rejects(() => storage.read({ ...ref, size: ref.size + 1 }), /represented size/);
  });

  it("enforces limits, removes idempotently, and serializes mutation leases", async () => {
    const storage = defineExternalFileStorage(await location("icarus-external-storage-"));
    const bytes = new TextEncoder().encode("bounded");
    const ref = descriptor(bytes);
    await assert.rejects(() => storage.put({ ...ref, bytes, maxBytes: 3 }), /exceeds/);

    await storage.put({ ...ref, bytes });
    assert.equal(await storage.remove(ref), true);
    assert.equal(await storage.remove(ref), false);

    const releaseFirst = await storage.acquireMutation();
    let entered = false;
    const second = storage.acquireMutation().then((release) => {
      entered = true;
      release();
    });
    await Promise.resolve();
    assert.equal(entered, false);
    releaseFirst();
    await second;
    assert.equal(entered, true);
  });
});
