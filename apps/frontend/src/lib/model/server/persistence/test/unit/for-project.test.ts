import assert from "node:assert/strict";
import { test } from "vitest";
import type { Logger } from "$model/server/observability/index.server";
import type { ProjectDatabase } from "$model/server/persistence/index.server";
import { ProjectRegistry } from "$model/server/persistence/definition";

/**
 * The registry is the piece the design leans on hardest: PGlite is single
 * user/connection, so opening one project twice is not a performance problem but
 * a correctness one. These tests exist because that guarantee is invisible in
 * the code — `??=` and a cached promise look interchangeable until two requests
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
  const both = Promise.all([registry.forProject("alpha"), registry.forProject("alpha")]);
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

  await registry.forProject("alpha");
  await registry.forProject("alpha");

  assert.equal(opens, 1);
});

test("keeps projects apart", async () => {
  const registry = new ProjectRegistry(async (projectId) => fakeProject(projectId), silent);

  const alpha = await registry.forProject("alpha");
  const beta = await registry.forProject("beta");

  assert.equal(alpha.projectId, "alpha");
  assert.equal(beta.projectId, "beta");
});

test("two registries share nothing", async () => {
  // Lifetime is a fact about the composition root. Nothing below it caches, so
  // two registries built over two openers stay independent.
  const first = new ProjectRegistry(async (projectId) => fakeProject(`first-${projectId}`), silent);
  const second = new ProjectRegistry(
    async (projectId) => fakeProject(`second-${projectId}`),
    silent
  );

  assert.equal((await first.forProject("alpha")).projectId, "first-alpha");
  assert.equal((await second.forProject("alpha")).projectId, "second-alpha");
});

test("evicts a failed open so the next caller retries", async () => {
  let attempts = 0;
  const registry = new ProjectRegistry(async (projectId) => {
    attempts += 1;
    if (attempts === 1) throw new Error("disk was busy");
    return fakeProject(projectId);
  }, silent);

  await assert.rejects(registry.forProject("alpha"), /disk was busy/);

  // Without eviction this would replay the same rejection for the life of the
  // process, turning a transient failure into a permanent one.
  const project = await registry.forProject("alpha");
  assert.equal(project.projectId, "alpha");
  assert.equal(attempts, 2);
});

test("rejects an unsafe project id before anything is opened", () => {
  let opens = 0;
  const registry = new ProjectRegistry(async (projectId) => {
    opens += 1;
    return fakeProject(projectId);
  }, silent);

  // Thrown rather than rejected, and deliberately: the id is a decision taken
  // before any work starts, so there is no promise for it to travel on.
  assert.throws(() => registry.forProject("../etc"), /not usable as a directory name/);
  assert.equal(opens, 0);
});
