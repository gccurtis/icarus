import assert from "node:assert/strict";
import { test } from "vitest";
import { createConfiguration } from "$model/client/configuration";
import { createDocumentRuntimes } from "$model/client/document-runtimes";

/**
 * The register: what is open, what is settling, and the one property everything
 * else rests on — one runtime per document, never per tab.
 */
const register = (afterOps = 50, afterMs = 2000) =>
  createDocumentRuntimes(
    createConfiguration({ revisions: { changeSets: { flushAfterOps: afterOps, flushAfterMs: afterMs } } })
  );

test("attach opens a document", () => {
  const runtimes = register();
  const runtime = runtimes.attach("k57");

  assert.deepEqual(runtimes.open, ["k57"]);
  assert.equal(runtime.sync, "loading");
  assert.equal(runtime.body, undefined);
});

test("attach is idempotent, so a second tab on one document is free", () => {
  // The whole reason the register is keyed by document: two views of one
  // document share a buffer, which is the only way both can be correct.
  const runtimes = register();

  const first = runtimes.attach("k57");
  const second = runtimes.attach("k57");

  assert.equal(first, second);
  assert.deepEqual(runtimes.open, ["k57"]);
});

test("two documents are two runtimes", () => {
  const runtimes = register();

  const a = runtimes.attach("k57");
  const b = runtimes.attach("k58");

  assert.notEqual(a, b);
  assert.deepEqual([...runtimes.open].sort(), ["k57", "k58"]);
});

test("release takes a document out of open", () => {
  const runtimes = register();
  runtimes.attach("k57");

  runtimes.release("k57");

  assert.deepEqual(runtimes.open, []);
});

test("releasing something that is not open is a no-op", () => {
  // The workbench calls this when the *last* tab on a document closes, and
  // "last" is a count it can get wrong at the edges. A throw would take the
  // frame down over a bookkeeping slip that costs nothing.
  const runtimes = register();

  assert.doesNotThrow(() => runtimes.release("never-opened"));
  assert.doesNotThrow(() => {
    runtimes.attach("k57");
    runtimes.release("k57");
    runtimes.release("k57");
  });
});

test("reattaching before a release settles revives the runtime rather than duplicating it", () => {
  // Close a tab and reopen it inside the flush window. Minting a second runtime
  // there would put two buffers on one document at the moment one is mid-flush.
  const runtimes = register();
  const first = runtimes.attach("k57");
  first.apply([{ op: "set", target: "row", path: "rows/#r1", value: 2, was: 1 }]);

  runtimes.release("k57");
  const second = runtimes.attach("k57");

  assert.equal(second, first);
  assert.deepEqual(runtimes.open, ["k57"]);
});

test("releaseAll empties the register", () => {
  const runtimes = register();
  runtimes.attach("k57");
  runtimes.attach("k58");
  runtimes.attach("k59");

  runtimes.releaseAll();

  assert.deepEqual(runtimes.open, []);
});

test("nothing is flushing when nothing has been applied", () => {
  const runtimes = register();
  runtimes.attach("k57");

  assert.deepEqual(runtimes.flushing, []);
});

test("the map is not reachable through the surface", () => {
  // A caller that could reach into it could hold a runtime past its release.
  const runtimes = register();
  runtimes.attach("k57");

  assert.deepEqual(Object.keys(runtimes), []);
  assert.equal((runtimes as unknown as { open: unknown[] }).open.length, 1);
  assert.ok(Array.isArray(runtimes.open));
});

test("the register refuses to build without its thresholds", () => {
  // Read at construction rather than at flush time, so a key missing from the
  // published list fails while the graph is being built rather than the first
  // time somebody types.
  assert.throws(
    () => createDocumentRuntimes(createConfiguration({})),
    /revisions\.changeSets\.flushAfterOps/
  );
});
