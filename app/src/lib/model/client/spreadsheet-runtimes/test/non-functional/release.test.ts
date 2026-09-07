import assert from "node:assert/strict";
import { afterEach, beforeEach, test, vi } from "vitest";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import { createConfiguration } from "$model/client/configuration";
import { createSpreadsheetRuntimes } from "$model/client/spreadsheet-runtimes";
import { Runtime } from "$model/client/spreadsheet-runtimes/definition.svelte";
import { rebase } from "$model/client/spreadsheet-runtimes/methods/flush/rebase";

vi.mock("$capabilities/spreadsheet/index.remote", () => ({
  readSpreadsheet: () =>
    Object.assign(new Promise(() => {}), { refresh: () => Promise.resolve(), ready: false }),
  submitSpreadsheetChanges: ({ changeSet }: { changeSet: { baseRevision: number } }) =>
    Promise.resolve({ accepted: true, revision: changeSet.baseRevision + 1 })
}));

const THRESHOLDS = { afterOps: 50, afterMs: 2000, syncEveryMs: 0 };

const register = (afterOps = 50, afterMs = 2000) =>
  createSpreadsheetRuntimes(
    createConfiguration({
      revisions: {
        changeSets: { flushAfterOps: afterOps, flushAfterMs: afterMs },
        sync: { everyMs: 0 }
      }
    })
  );

const set = (cell: string, value: number): SpreadsheetOp => ({
  op: "set",
  target: "cell",
  path: `${cell}/value`,
  value: { kind: "number", value },
  was: { kind: "number", value: value - 1 }
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test("release submits what was buffered", async () => {
  const runtimes = register();
  const runtime = runtimes.attach("x9");
  runtime.apply([set("r1/c1", 1)]);

  runtimes.release("x9");
  await vi.runAllTimersAsync();

  assert.equal(runtime.pending, 0);
  assert.equal(runtime.revision, 1);
});

test("releaseAll submits every open buffer", async () => {
  const runtimes = register();
  const first = runtimes.attach("x9");
  const second = runtimes.attach("x10");
  first.apply([set("r1/c1", 1)]);
  second.apply([set("r2/c2", 2)]);

  runtimes.releaseAll();
  await vi.runAllTimersAsync();

  assert.equal(first.pending, 0);
  assert.equal(second.pending, 0);
  assert.deepEqual(runtimes.open, []);
});

test("a released runtime leaves the register once its submit settles", async () => {
  const runtimes = register();
  const runtime = runtimes.attach("x9");
  runtime.apply([set("r1/c1", 1)]);

  runtimes.release("x9");
  await vi.runAllTimersAsync();

  assert.deepEqual(runtimes.open, []);
  assert.deepEqual(runtimes.flushing, []);
});

test("release cancels the pending debounce rather than leaving a timer behind", async () => {
  const runtimes = register(50, 2000);
  const runtime = runtimes.attach("x9");
  runtime.apply([set("r1/c1", 1)]);

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
  const runtime = new Runtime("x9", THRESHOLDS);
  runtime.buffer = [set("r9/c9", 9)];

  rebase(runtime, [set("r1/c1", 1)], { revision: 7, retryable: true });

  assert.equal(runtime.buffer.length, 2);
  assert.equal(runtime.buffer[0].path, "r1/c1/value");
  assert.equal(runtime.buffer[1].path, "r9/c9/value");
});

test("a rebase adopts the server's revision", () => {
  const runtime = new Runtime("x9", THRESHOLDS);

  rebase(runtime, [set("r1/c1", 1)], { revision: 42, retryable: true });

  assert.equal(runtime.revision, 42);
  assert.equal(runtime.sync, "rebasing");
});

test("a refusal the ladder cannot resolve needs review, and keeps the work", () => {
  const runtime = new Runtime("x9", THRESHOLDS);

  rebase(runtime, [set("r1/c1", 1)], { revision: 42, retryable: false });

  assert.equal(runtime.sync, "needs-review");
  assert.equal(runtime.buffer.length, 1);
});

test("a runtime that cannot submit keeps reporting rather than disappearing", () => {
  const runtimes = register();
  const runtime = runtimes.attach("x9") as unknown as Runtime;
  runtime.apply([set("r1/c1", 1)]);
  runtime.sync = "error";

  assert.equal(runtime.pending, 1);
  assert.equal(runtime.sync, "error");
});
