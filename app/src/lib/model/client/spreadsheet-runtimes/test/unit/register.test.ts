import assert from "node:assert/strict";
import { test } from "vitest";
import { createConfiguration } from "$model/client/configuration";
import { createSpreadsheetRuntimes } from "$model/client/spreadsheet-runtimes";

/**
 * The register: what is open, what is settling, and the one property everything
 * else rests on — one runtime per sheet, never per tab.
 */
const register = (afterOps = 50, afterMs = 2000) =>
  createSpreadsheetRuntimes(
    createConfiguration({ revisions: { changeSets: { flushAfterOps: afterOps, flushAfterMs: afterMs } } })
  );

test("attach opens a sheet", () => {
  const runtimes = register();
  const runtime = runtimes.attach("x9");

  assert.deepEqual(runtimes.open, ["x9"]);
  assert.equal(runtime.sync, "loading");
  assert.equal(runtime.body, undefined);
});

test("attach is idempotent, so a second tab on one sheet is free", () => {
  // The whole reason the register is keyed by sheet: two views of one sheet
  // share a buffer, which is the only way both can be correct.
  const runtimes = register();

  const first = runtimes.attach("x9");
  const second = runtimes.attach("x9");

  assert.equal(first, second);
  assert.deepEqual(runtimes.open, ["x9"]);
});

test("two sheets are two runtimes", () => {
  const runtimes = register();

  const a = runtimes.attach("x9");
  const b = runtimes.attach("x10");

  assert.notEqual(a, b);
  assert.deepEqual([...runtimes.open].sort(), ["x10", "x9"]);
});

test("release takes a sheet out of open", () => {
  const runtimes = register();
  runtimes.attach("x9");

  runtimes.release("x9");

  assert.deepEqual(runtimes.open, []);
});

test("releasing something that is not open is a no-op", () => {
  // The workbench calls this when the *last* tab on a sheet closes, and "last"
  // is a count it can get wrong at the edges.
  const runtimes = register();

  assert.doesNotThrow(() => runtimes.release("never-opened"));
  assert.doesNotThrow(() => {
    runtimes.attach("x9");
    runtimes.release("x9");
    runtimes.release("x9");
  });
});

test("reattaching before a release settles revives the runtime rather than duplicating it", () => {
  // Close a tab and reopen it inside the flush window. Minting a second runtime
  // there would put two buffers on one sheet at the moment one is mid-flush.
  const runtimes = register();
  const first = runtimes.attach("x9");
  first.apply([{ op: "set", target: "cell", path: "cells/#A1", value: 2, was: 1 }]);

  runtimes.release("x9");
  const second = runtimes.attach("x9");

  assert.equal(second, first);
  assert.deepEqual(runtimes.open, ["x9"]);
});

test("releaseAll empties the register", () => {
  const runtimes = register();
  runtimes.attach("x9");
  runtimes.attach("x10");
  runtimes.attach("x11");

  runtimes.releaseAll();

  assert.deepEqual(runtimes.open, []);
});

test("nothing is flushing when nothing has been applied", () => {
  const runtimes = register();
  runtimes.attach("x9");

  assert.deepEqual(runtimes.flushing, []);
});

test("the map is not reachable through the surface", () => {
  // A caller that could reach into it could hold a runtime past its release.
  const runtimes = register();
  runtimes.attach("x9");

  assert.deepEqual(Object.keys(runtimes), []);
  assert.equal((runtimes as unknown as { open: unknown[] }).open.length, 1);
  assert.ok(Array.isArray(runtimes.open));
});

test("the register refuses to build without its thresholds", () => {
  // Read at construction rather than at flush time, so a key missing from the
  // published list fails while the graph is being built.
  assert.throws(
    () => createSpreadsheetRuntimes(createConfiguration({})),
    /revisions\.changeSets\.flushAfterOps/
  );
});
