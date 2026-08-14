import assert from "node:assert/strict";
import { test } from "vitest";
import type { Logger } from "$runtime/server/observability/types";
import type { ProjectDatabase } from "$runtime/server/persistence/registry";
import { ProjectRegistry, assertSafeProjectId } from "$runtime/server/persistence/registry";

/**
 * The registry is the piece the design leans on hardest: PGlite is single
 * user/connection, so opening one project twice is not a performance問題 but a
 * correctness one. These tests exist because that guarantee is invisible in the
 * code — `??=` and a cached promise look interchangeable until two requests
 * arrive together.
 */

const silent: Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

/** A stand-in project that records how many times it was opened and closed. */
const fakeProject = (projectId: string, onClose?: () => void): ProjectDatabase => ({
  projectId,
  database: undefined as never,
  close: async () => onClose?.()
});

test("opens a project once, however many callers ask at the same time", async () => {
  let opens = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));

  const registry = new ProjectRegistry(async (projectId) => {
    opens += 1;
    await gate;
    return fakeProject(projectId);
  }, silent);

  // Both calls happen before the first open resolves — the case a value cache
  // would get wrong and a promise cache gets right.
  const both = Promise.all([registry.get("alpha"), registry.get("alpha")]);
  release();
  const [first, second] = await both;

  assert.equal(opens, 1, "a second concurrent caller must await the first open");
  assert.equal(first, second, "both callers receive the same database");
});

test("returns the same project to later callers", async () => {
  let opens = 0;
  const registry = new ProjectRegistry(async (projectId) => {
    opens += 1;
    return fakeProject(projectId);
  }, silent);

  await registry.get("alpha");
  await registry.get("alpha");

  assert.equal(opens, 1);
});

test("keeps projects apart", async () => {
  const registry = new ProjectRegistry(async (projectId) => fakeProject(projectId), silent);

  const alpha = await registry.get("alpha");
  const beta = await registry.get("beta");

  assert.equal(alpha.projectId, "alpha");
  assert.equal(beta.projectId, "beta");
});

test("evicts a failed open so the next caller retries", async () => {
  let attempts = 0;
  const registry = new ProjectRegistry(async (projectId) => {
    attempts += 1;
    if (attempts === 1) throw new Error("disk was busy");
    return fakeProject(projectId);
  }, silent);

  await assert.rejects(registry.get("alpha"), /disk was busy/);

  // Without eviction this would replay the same rejection for the life of the
  // process, turning a transient failure into a permanent one.
  const project = await registry.get("alpha");
  assert.equal(project.projectId, "alpha");
  assert.equal(attempts, 2);
});

test("closes every open project", async () => {
  const closed: string[] = [];
  const registry = new ProjectRegistry(
    async (projectId) => fakeProject(projectId, () => closed.push(projectId)),
    silent
  );

  await registry.get("alpha");
  await registry.get("beta");
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

  await registry.get("alpha");
  await registry.get("beta");

  // Settling rather than racing is the point: one stuck project must not leave
  // the rest holding their directories.
  await assert.rejects(registry.close(), (error: unknown) => {
    assert.ok(error instanceof AggregateError);
    assert.match(error.message, /1 project database\(s\) could not be closed/);
    return true;
  });

  assert.deepEqual(closed, ["alpha"]);
});

// ------------------------------------------------------- project id shape ----

test("admits an ordinary project id", () => {
  for (const id of ["default", "a", "project-1", "a_b-c", "9lives"]) {
    assert.doesNotThrow(() => assertSafeProjectId(id), `${id} should be admitted`);
  }
});

test("rejects anything that could escape the projects directory", () => {
  for (const id of ["..", "../etc", "a/b", "a\\b", ".hidden", "/abs", "a\0b"]) {
    assert.throws(() => assertSafeProjectId(id), /not usable as a directory name/, `${id} escaped`);
  }
});

test("rejects uppercase, so a case-folding filesystem cannot merge two projects", () => {
  // APFS and NTFS fold `Alpha` and `alpha` to one directory while the registry
  // keys them separately — two projects sharing one database, held by two
  // single-connection instances at once.
  assert.throws(() => assertSafeProjectId("Alpha"), /not usable as a directory name/);
});

test("rejects an empty id and one past the length limit", () => {
  assert.throws(() => assertSafeProjectId(""), /not usable as a directory name/);
  assert.throws(() => assertSafeProjectId("a".repeat(65)), /not usable as a directory name/);
  assert.doesNotThrow(() => assertSafeProjectId("a".repeat(64)));
});

test("rejects a trailing newline, which a line-oriented source can smuggle in", () => {
  assert.throws(() => assertSafeProjectId("alpha\n"), /not usable as a directory name/);
});
