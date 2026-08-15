import assert from "node:assert/strict";
import { test } from "vitest";
import type { Logger } from "$model/server/observability/index.server";
import type { ProjectDatabase } from "$model/server/persistence/index.server";
import { ProjectRegistry } from "$model/server/persistence/definition";

const silent: Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

const fakeProject = (projectId: string, onClose?: () => void): ProjectDatabase => ({
  projectId,
  database: undefined as never,
  close: async () => onClose?.()
});

test("closes every open project", async () => {
  const closed: string[] = [];
  const registry = new ProjectRegistry(
    async (projectId) => fakeProject(projectId, () => closed.push(projectId)),
    silent
  );

  await registry.forProject("alpha");
  await registry.forProject("beta");
  await registry.close();

  assert.deepEqual(closed.sort(), ["alpha", "beta"]);
});

test("closes the others when one fails, and reports the failure", async () => {
  const closed: string[] = [];
  const registry = new ProjectRegistry(
    async (projectId) =>
      fakeProject(projectId, () => {
        if (projectId === "beta") throw new Error("beta would not close");
        closed.push(projectId);
      }),
    silent
  );

  await registry.forProject("alpha");
  await registry.forProject("beta");

  // Settling rather than racing is the point: one stuck project must not leave
  // the rest holding their directories.
  await assert.rejects(registry.close(), (error: unknown) => {
    assert.ok(error instanceof AggregateError);
    assert.match(error.message, /1 project database\(s\) could not be closed/);
    return true;
  });

  assert.deepEqual(closed, ["alpha"]);
});

test("a project that failed to open is reported by close rather than blamed on it", async () => {
  const registry = new ProjectRegistry(async () => {
    throw new Error("never opened");
  }, silent);

  const opening = registry.forProject("alpha");
  await assert.rejects(opening, /never opened/);

  // The entry evicted itself, so shutdown has nothing left to settle.
  await registry.close();
});
