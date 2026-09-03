import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { createConfiguration } from "$model/client/configuration";
import { createSlideDeckRuntimes } from "$model/client/slide-deck-runtimes";

vi.mock("$capabilities/slide-deck/index.remote", () => ({
  readSlideDeckBody: () => new Promise(() => {})
}));

const register = (afterOps = 50, afterMs = 2000) =>
  createSlideDeckRuntimes(
    createConfiguration({ revisions: { changeSets: { flushAfterOps: afterOps, flushAfterMs: afterMs } } })
  );

test("attach opens a deck", () => {
  const runtimes = register();
  const runtime = runtimes.attach("s1");

  assert.deepEqual(runtimes.open, ["s1"]);
  assert.equal(runtime.sync, "loading");
  assert.equal(runtime.body, undefined);
});

test("attach is idempotent, so a second tab on one deck is free", () => {
  const runtimes = register();

  const first = runtimes.attach("s1");
  const second = runtimes.attach("s1");

  assert.equal(first, second);
  assert.deepEqual(runtimes.open, ["s1"]);
});

test("two decks are two runtimes", () => {
  const runtimes = register();

  const a = runtimes.attach("s1");
  const b = runtimes.attach("s2");

  assert.notEqual(a, b);
  assert.deepEqual([...runtimes.open].sort(), ["s1", "s2"]);
});

test("release takes a deck out of open", () => {
  const runtimes = register();
  runtimes.attach("s1");

  runtimes.release("s1");

  assert.deepEqual(runtimes.open, []);
});

test("releasing something that is not open is a no-op", () => {
  const runtimes = register();

  assert.doesNotThrow(() => runtimes.release("never-opened"));
  assert.doesNotThrow(() => {
    runtimes.attach("s1");
    runtimes.release("s1");
    runtimes.release("s1");
  });
});

test("reattaching before a release settles revives the runtime rather than duplicating it", () => {
  const runtimes = register();
  const first = runtimes.attach("s1");
  first.apply([{ op: "set", target: "slide", path: "slides/#a", value: 2, was: 1 }]);

  runtimes.release("s1");
  const second = runtimes.attach("s1");

  assert.equal(second, first);
  assert.deepEqual(runtimes.open, ["s1"]);
});

test("releaseAll empties the register", () => {
  const runtimes = register();
  runtimes.attach("s1");
  runtimes.attach("s2");
  runtimes.attach("s3");

  runtimes.releaseAll();

  assert.deepEqual(runtimes.open, []);
});

test("nothing is flushing when nothing has been applied", () => {
  const runtimes = register();
  runtimes.attach("s1");

  assert.deepEqual(runtimes.flushing, []);
});

test("the map is not reachable through the surface", () => {
  const runtimes = register();
  runtimes.attach("s1");

  assert.deepEqual(Object.keys(runtimes), []);
  assert.equal((runtimes as unknown as { open: unknown[] }).open.length, 1);
  assert.ok(Array.isArray(runtimes.open));
});

test("the register refuses to build without its thresholds", () => {
  assert.throws(
    () => createSlideDeckRuntimes(createConfiguration({})),
    /revisions\.changeSets\.flushAfterOps/
  );
});
