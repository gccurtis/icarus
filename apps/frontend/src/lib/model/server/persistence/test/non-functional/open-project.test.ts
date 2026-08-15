import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { test, vi } from "vitest";
import type { Logger } from "$model/server/observability/index.server";

/**
 * Resource ownership across a failed open.
 *
 * The instance is what holds the project's directory, so the assertion that
 * matters is not that the error is reported — it is that nothing is still held
 * when it is. A leaked instance locks the directory against the retry that the
 * registry's eviction exists to allow.
 *
 * PGlite is replaced rather than started: an embedded PostgreSQL costs roughly
 * 750ms to stand up, and none of what is being proven here needs one.
 */
const opened = vi.hoisted(() => ({ instances: [] as { closed: boolean }[] }));

vi.mock("@electric-sql/pglite", () => ({
  PGlite: {
    create: async () => {
      const instance = {
        closed: false,
        close: async () => {
          instance.closed = true;
        }
      };
      opened.instances.push(instance);
      return instance;
    }
  }
}));

const { openProject } = await import(
  "$model/server/persistence/methods/for-project/open-project/open-project"
);

const silent: Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

const context = async (initializers: (() => Promise<void>)[]) => ({
  root: await mkdtemp(join(tmpdir(), "icarus-persistence-")),
  logger: silent,
  initializers
});

test("releases the instance when a schema cannot be created", async () => {
  const failing = await context([
    async () => {
      throw new Error("schema failed");
    }
  ]);

  await assert.rejects(openProject(failing, "alpha"), /schema failed/);

  assert.equal(opened.instances.length, 1);
  assert.equal(opened.instances[0].closed, true, "the instance still holds the directory");
});

test("creates the project directory that PGlite would not create itself", async () => {
  const working = await context([]);

  const project = await openProject(working, "alpha");

  assert.equal(project.projectId, "alpha");
  assert.deepEqual(await readdir(working.root), ["alpha"]);
});
