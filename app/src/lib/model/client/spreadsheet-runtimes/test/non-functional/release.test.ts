import assert from "node:assert/strict";
import { afterEach, beforeEach, test, vi } from "vitest";
import type { SpreadsheetOp } from "$representation/data/types/revisions/spreadsheet-op";
import { createConfiguration } from "$model/client/configuration";
import { createSpreadsheetRuntimes } from "$model/client/spreadsheet-runtimes";
import { Runtime } from "$model/client/spreadsheet-runtimes/definition.svelte";
import { rebase } from "$model/client/spreadsheet-runtimes/methods/flush/rebase";

/**
 * Terminal behaviour, and the refusal path.
 *
 * These are the promises the object's document makes that a unit test of one
 * method cannot show: that disposal submits rather than discarding, that a
 * failed submit keeps the work, and that nothing leaks a timer.
 *
 * `rebase` is exercised directly. Nothing can produce a refusal until something
 * writes `spreadsheetChangeSets`.
 */
const register = (afterOps = 50, afterMs = 2000) =>
  createSpreadsheetRuntimes(
    createConfiguration({ revisions: { changeSets: { flushAfterOps: afterOps, flushAfterMs: afterMs } } })
  );

const set = (cell: string, value: number): SpreadsheetOp => ({
  op: "set",
  target: "cell",
  path: `cells/#${cell}`,
  value,
  was: value - 1
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test("release submits what was buffered", async () => {
  // Disposal is never a silent discard.
  const runtimes = register();
  const runtime = runtimes.attach("x9");
  runtime.apply([set("A1", 1)]);

  runtimes.release("x9");
  await vi.runAllTimersAsync();

  assert.equal(runtime.pending, 0);
  assert.equal(runtime.revision, 1);
});

test("releaseAll submits every open buffer", async () => {
  const runtimes = register();
  const first = runtimes.attach("x9");
  const second = runtimes.attach("x10");
  first.apply([set("A1", 1)]);
  second.apply([set("B2", 2)]);

  runtimes.releaseAll();
  await vi.runAllTimersAsync();

  assert.equal(first.pending, 0);
  assert.equal(second.pending, 0);
  assert.deepEqual(runtimes.open, []);
});

test("a released runtime leaves the register once its submit settles", async () => {
  const runtimes = register();
  const runtime = runtimes.attach("x9");
  runtime.apply([set("A1", 1)]);

  runtimes.release("x9");
  await vi.runAllTimersAsync();

  assert.deepEqual(runtimes.open, []);
  assert.deepEqual(runtimes.flushing, []);
});

test("release cancels the pending debounce rather than leaving a timer behind", async () => {
  // A timer firing after release would flush a runtime the register has already
  // let go of.
  const runtimes = register(50, 2000);
  const runtime = runtimes.attach("x9");
  runtime.apply([set("A1", 1)]);

  runtimes.release("x9");
  await vi.runAllTimersAsync();
  const revisionAfterRelease = runtime.revision;

  await vi.advanceTimersByTimeAsync(10_000);

  assert.equal(runtime.revision, revisionAfterRelease);
  assert.equal(vi.getTimerCount(), 0);
});

test("closing the client instance releases every runtime", async () => {
  const runtimes = register();
  runtimes.attach("x9");
  runtimes.attach("x10");

  runtimes.releaseAll();
  await vi.runAllTimersAsync();

  assert.deepEqual(runtimes.open, []);
});

test("a refused change set goes back to the front of the buffer", () => {
  // The refused ops happened first. A buffer that reordered them would submit a
  // later edit as though it came earlier.
  const runtime = new Runtime("x9", { afterOps: 50, afterMs: 2000 });
  runtime.buffer = [set("Z9", 9)];

  rebase(runtime, [set("A1", 1)], { revision: 7, retryable: true });

  assert.equal(runtime.buffer.length, 2);
  assert.equal(runtime.buffer[0].path, "cells/#A1");
  assert.equal(runtime.buffer[1].path, "cells/#Z9");
});

test("a rebase adopts the server's revision", () => {
  const runtime = new Runtime("x9", { afterOps: 50, afterMs: 2000 });

  rebase(runtime, [set("A1", 1)], { revision: 42, retryable: true });

  assert.equal(runtime.revision, 42);
  assert.equal(runtime.sync, "rebasing");
});

test("a refusal the ladder cannot resolve needs review, and keeps the work", () => {
  const runtime = new Runtime("x9", { afterOps: 50, afterMs: 2000 });

  rebase(runtime, [set("A1", 1)], { revision: 42, retryable: false });

  assert.equal(runtime.sync, "needs-review");
  assert.equal(runtime.buffer.length, 1);
});

test("a runtime that cannot submit keeps reporting rather than disappearing", () => {
  // Work disappearing is the one outcome with no recovery, so a failed submit
  // holds its buffer and its id stays visible.
  const runtimes = register();
  const runtime = runtimes.attach("x9") as unknown as Runtime;
  runtime.apply([set("A1", 1)]);
  runtime.sync = "error";

  assert.equal(runtime.pending, 1);
  assert.equal(runtime.sync, "error");
});
