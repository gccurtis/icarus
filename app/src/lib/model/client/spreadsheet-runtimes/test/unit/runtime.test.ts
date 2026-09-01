import assert from "node:assert/strict";
import { afterEach, beforeEach, test, vi } from "vitest";
import type { SpreadsheetOp } from "$representation/data/types/revisions/spreadsheet-op";
import { createConfiguration } from "$model/client/configuration";
import { createSpreadsheetRuntimes } from "$model/client/spreadsheet-runtimes";
import type { SpreadsheetRuntime } from "$model/client/spreadsheet-runtimes";

/**
 * One runtime: buffering, the flush schedule, and the history stacks.
 *
 * Thresholds are small here so the op-count path is reachable without writing
 * fifty ops into every test. `flushAfterMs` is exercised with fake timers,
 * because the debounce is the half of the schedule a count never reaches.
 */
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
  // What makes an undo undo a gesture rather than a keystroke — filling a range
  // is one gesture and one entry, whatever it touched.
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
  // Refreshed rather than left running, which is what makes the two thresholds
  // mean different things instead of the clock always winning.
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
  // Two submits carrying half a buffer each against one base revision would have
  // the second refused for a conflict it created itself.
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
  // Recording it would make an undo undoable, and two undos in a row would flip
  // between the same two states forever.
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
  // canUndo is the question, and a UI that asked it first should not be the only
  // thing standing between a keystroke and a throw.
  const runtime = runtimeFor();

  assert.doesNotThrow(() => runtime.undo());
  assert.doesNotThrow(() => runtime.redo());
  assert.equal(runtime.pending, 0);
});

test("a new edit clears the redo stack", () => {
  // The branch a redo led to is unreachable once something else is applied.
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
  // What a subscription that has not delivered yet looks like. The read is
  // forward-declared, so this is the state a runtime opens in today.
  const runtime = runtimeFor();

  assert.equal(runtime.sync, "loading");
  assert.equal(runtime.body, undefined);
});
