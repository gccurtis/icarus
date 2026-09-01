import assert from "node:assert/strict";
import { test } from "vitest";
import { createConfiguration } from "$model/client/configuration";
import { createSlideDeckRuntimes } from "$model/client/slide-deck-runtimes";

/**
 * The register: what is open, what is settling, and the one property everything
 * else rests on — one runtime per deck, never per tab.
 */
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
  // The whole reason the register is keyed by deck: two views of one deck share
  // a buffer, which is the only way both can be correct.
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
  // The workbench calls this when the *last* tab on a deck closes, and "last" is
  // a count it can get wrong at the edges.
  const runtimes = register();

  assert.doesNotThrow(() => runtimes.release("never-opened"));
  assert.doesNotThrow(() => {
    runtimes.attach("s1");
    runtimes.release("s1");
    runtimes.release("s1");
  });
});

test("reattaching before a release settles revives the runtime rather than duplicating it", () => {
  // Close a tab and reopen it inside the flush window. Minting a second runtime
  // there would put two buffers on one deck at the moment one is mid-flush.
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
  // A caller that could reach into it could hold a runtime past its release.
  const runtimes = register();
  runtimes.attach("s1");

  assert.deepEqual(Object.keys(runtimes), []);
  assert.equal((runtimes as unknown as { open: unknown[] }).open.length, 1);
  assert.ok(Array.isArray(runtimes.open));
});

test("the register refuses to build without its thresholds", () => {
  // Read at construction rather than at flush time, so a key missing from the
  // published list fails while the graph is being built.
  assert.throws(
    () => createSlideDeckRuntimes(createConfiguration({})),
    /revisions\.changeSets\.flushAfterOps/
  );
});
