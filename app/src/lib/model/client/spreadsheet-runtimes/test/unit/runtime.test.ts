import assert from "node:assert/strict";
import { afterEach, beforeEach, test, vi } from "vitest";
import type { SpreadsheetOp } from "$representation/data/types/revisions/spreadsheet-op";
import { createConfiguration } from "$model/client/configuration";
import { createSpreadsheetRuntimes } from "$model/client/spreadsheet-runtimes";
import type { SpreadsheetRuntime } from "$model/client/spreadsheet-runtimes";

const runtimeFor = (afterOps = 3, afterMs = 2000): SpreadsheetRuntime =>
  createSpreadsheetRuntimes(
    createConfiguration({ revisions: { changeSets: { flushAfterOps: afterOps, flushAfterMs: afterMs } } })
  ).attach("x9");

const set = (cell: string, value: number): SpreadsheetOp => ({
  op: "set",
  target: "cell",
  path: `cells/#${cell}`,
  value,
  was: value - 1
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test("apply buffers without awaiting anything", () => {
  const runtime = runtimeFor();

  runtime.apply([set("A1", 1)]);

  assert.equal(runtime.pending, 1);
});

test("applying nothing does nothing", () => {
  const runtime = runtimeFor();

  runtime.apply([]);

  assert.equal(runtime.pending, 0);
  assert.equal(runtime.canUndo, false);
});

test("one apply is one undoable gesture, however many ops it carries", () => {
  const runtime = runtimeFor();

  runtime.apply([set("A1", 1), set("A2", 2), set("A3", 3)]);

  assert.equal(runtime.canUndo, true);
  runtime.undo();
  assert.equal(runtime.canUndo, false);
});

test("reaching the op threshold submits", async () => {
  const runtime = runtimeFor(3);

  runtime.apply([set("A1", 1), set("A2", 2), set("A3", 3)]);
  await vi.runAllTimersAsync();

  assert.equal(runtime.pending, 0);
  assert.equal(runtime.sync, "saved");
  assert.equal(runtime.revision, 1);
});

test("stopping submits on the clock", async () => {
  const runtime = runtimeFor(50, 2000);

  runtime.apply([set("A1", 1)]);
  assert.equal(runtime.pending, 1);

  await vi.advanceTimersByTimeAsync(2000);

  assert.equal(runtime.pending, 0);
  assert.equal(runtime.sync, "saved");
});

test("the debounce measures from the last op, not the first", () => {
  const runtime = runtimeFor(50, 2000);

  runtime.apply([set("A1", 1)]);
  vi.advanceTimersByTime(1500);
  runtime.apply([set("A2", 2)]);
  vi.advanceTimersByTime(1500);

  assert.equal(runtime.pending, 2);
});

test("a flush advances the revision and empties the buffer", async () => {
  const runtime = runtimeFor();
  runtime.apply([set("A1", 1)]);

  await runtime.flush();

  assert.equal(runtime.revision, 1);
  assert.equal(runtime.pending, 0);
  assert.equal(runtime.sync, "saved");
});

test("flushing an empty buffer does nothing", async () => {
  const runtime = runtimeFor();

  await runtime.flush();

  assert.equal(runtime.revision, 0);
  assert.equal(runtime.sync, "loading");
});

test("two flushes join rather than submitting twice", async () => {
  const runtime = runtimeFor();
  runtime.apply([set("A1", 1)]);

  await Promise.all([runtime.flush(), runtime.flush(), runtime.flush()]);

  assert.equal(runtime.revision, 1);
});

test("ops applied during a flush survive for the next one", async () => {
  const runtime = runtimeFor(50, 2000);
  runtime.apply([set("A1", 1)]);

  const inFlight = runtime.flush();
  runtime.apply([set("A2", 2)]);
  await inFlight;

  assert.equal(runtime.pending, 1);
});

test("undo buffers the inverse without recording a new gesture", async () => {
  const runtime = runtimeFor(50, 2000);
  runtime.apply([set("A1", 5)]);
  await runtime.flush();

  runtime.undo();

  assert.equal(runtime.pending, 1);
  assert.equal(runtime.canUndo, false);
  assert.equal(runtime.canRedo, true);
});

test("undo then redo walks back and forward through the stacks", () => {
  const runtime = runtimeFor(50, 2000);
  runtime.apply([set("A1", 1)]);
  runtime.apply([set("A2", 2)]);

  runtime.undo();
  assert.equal(runtime.canUndo, true);
  assert.equal(runtime.canRedo, true);

  runtime.undo();
  assert.equal(runtime.canUndo, false);

  runtime.redo();
  assert.equal(runtime.canUndo, true);
  assert.equal(runtime.canRedo, true);
});

test("undo with nothing to undo is a no-op, not a throw", () => {
  const runtime = runtimeFor();

  assert.doesNotThrow(() => runtime.undo());
  assert.doesNotThrow(() => runtime.redo());
  assert.equal(runtime.pending, 0);
});

test("a new edit clears the redo stack", () => {
  const runtime = runtimeFor(50, 2000);
  runtime.apply([set("A1", 1)]);
  runtime.undo();
  assert.equal(runtime.canRedo, true);

  runtime.apply([set("A2", 2)]);

  assert.equal(runtime.canRedo, false);
});

test("undo survives a flush, because history is not the buffer", async () => {
  const runtime = runtimeFor(50, 2000);
  runtime.apply([set("A1", 1)]);
  await runtime.flush();

  assert.equal(runtime.pending, 0);
  assert.equal(runtime.canUndo, true);
});

test("sync says loading until something lands, and body stays undefined", () => {
  const runtime = runtimeFor();

  assert.equal(runtime.sync, "loading");
  assert.equal(runtime.body, undefined);
});
