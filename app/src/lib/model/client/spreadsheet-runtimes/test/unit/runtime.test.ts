import assert from "node:assert/strict";
import { afterEach, beforeEach, test, vi } from "vitest";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import { createSpreadsheetRuntimes } from "$model/client/spreadsheet-runtimes";
import type { SpreadsheetRuntime } from "$model/client/spreadsheet-runtimes";

const wire = vi.hoisted(() => ({
  refusals: 0,
  fault: false,
  readLands: false,
  sent: [] as { baseRevision: number; ops: unknown[]; touched: string[] }[]
}));

vi.mock("$capabilities/spreadsheet/index.remote", () => ({
  readSpreadsheet: () =>
    Object.assign(wire.readLands ? Promise.resolve(null) : new Promise(() => {}), {
      refresh: () => Promise.resolve(),
      ready: false
    }),
  submitSpreadsheetChanges: ({
    changeSet
  }: {
    changeSet: { baseRevision: number; ops: unknown[]; touched: string[] };
  }) => {
    if (wire.fault) return Promise.reject(new Error("offline"));

    wire.sent.push(changeSet);
    if (wire.refusals === 0) {
      return Promise.resolve({ accepted: true, revision: changeSet.baseRevision + 1 });
    }

    wire.refusals -= 1;
    return Promise.resolve({
      accepted: false,
      reason: "stale",
      revision: changeSet.baseRevision + 4,
      detail: "moved on"
    });
  }
}));

const runtimeFor = (afterOps = 3, afterMs = 2000): SpreadsheetRuntime =>
  createSpreadsheetRuntimes({ afterOps, afterMs, syncEveryMs: 0 }).attach("x9");

const set = (cell: string, value: number): SpreadsheetOp => ({
  op: "set",
  target: "cell",
  path: `${cell}/value`,
  value: { kind: "number", value },
  was: { kind: "number", value: value - 1 }
});

beforeEach(() => {
  wire.refusals = 0;
  wire.fault = false;
  wire.readLands = false;
  wire.sent.length = 0;
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

test("apply buffers without awaiting anything", () => {
  const runtime = runtimeFor();

  runtime.apply([set("r1/c1", 1)]);

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

  runtime.apply([set("r1/c1", 1), set("r2/c1", 2), set("r3/c1", 3)]);

  assert.equal(runtime.canUndo, true);
  runtime.undo();
  assert.equal(runtime.canUndo, false);
});

test("reaching the op threshold submits", async () => {
  const runtime = runtimeFor(3);

  runtime.apply([set("r1/c1", 1), set("r2/c1", 2), set("r3/c1", 3)]);
  await vi.runAllTimersAsync();

  assert.equal(runtime.pending, 0);
  assert.equal(runtime.sync, "saved");
  assert.equal(runtime.revision, 1);
});

test("stopping submits on the clock", async () => {
  const runtime = runtimeFor(50, 2000);

  runtime.apply([set("r1/c1", 1)]);
  assert.equal(runtime.pending, 1);

  await vi.advanceTimersByTimeAsync(2000);

  assert.equal(runtime.pending, 0);
  assert.equal(runtime.sync, "saved");
});

test("the debounce measures from the last op, not the first", () => {
  const runtime = runtimeFor(50, 2000);

  runtime.apply([set("r1/c1", 1)]);
  vi.advanceTimersByTime(1500);
  runtime.apply([set("r2/c1", 2)]);
  vi.advanceTimersByTime(1500);

  assert.equal(runtime.pending, 2);
});

test("a flush advances the revision and empties the buffer", async () => {
  const runtime = runtimeFor();
  runtime.apply([set("r1/c1", 1)]);

  await runtime.flush();

  assert.equal(runtime.revision, 1);
  assert.equal(runtime.pending, 0);
  assert.equal(runtime.sync, "saved");
});

test("what goes over the wire is the coalesced buffer, with touched paths beside it", async () => {
  const runtime = runtimeFor();
  runtime.apply([set("r1/c1", 1)]);
  runtime.apply([set("r1/c1", 2)]);
  runtime.apply([set("r2/c1", 5)]);

  await runtime.flush();

  assert.equal(wire.sent.length, 1);
  assert.equal(wire.sent[0].ops.length, 2);
  assert.deepEqual(wire.sent[0].touched, ["r1/c1/value", "r2/c1/value"]);
});

test("flushing an empty buffer does nothing", async () => {
  const runtime = runtimeFor();

  await runtime.flush();

  assert.equal(runtime.revision, 0);
  assert.equal(runtime.sync, "loading");
});

test("two flushes join rather than submitting twice", async () => {
  const runtime = runtimeFor();
  runtime.apply([set("r1/c1", 1)]);

  await Promise.all([runtime.flush(), runtime.flush(), runtime.flush()]);

  assert.equal(runtime.revision, 1);
  assert.equal(wire.sent.length, 1);
});

test("ops applied during a flush survive for the next one", async () => {
  const runtime = runtimeFor(50, 2000);
  runtime.apply([set("r1/c1", 1)]);

  const inFlight = runtime.flush();
  runtime.apply([set("r2/c1", 2)]);
  await inFlight;

  assert.equal(runtime.pending, 1);
});

test("a stale refusal is restated at the leader's revision and sent again", async () => {
  const runtime = runtimeFor(50, 2000);
  wire.refusals = 1;
  runtime.apply([set("r1/c1", 1)]);

  await runtime.flush();

  assert.equal(wire.sent.length, 2);
  assert.equal(wire.sent[1].baseRevision, 4);
  assert.equal(runtime.revision, 5);
  assert.equal(runtime.sync, "saved");
  assert.equal(runtime.pending, 0);
});

test("a second refusal in a row reverts to what the server holds and is left for a person", async () => {
  wire.readLands = true;
  const runtime = runtimeFor(50, 2000);
  wire.refusals = 2;
  runtime.apply([set("r1/c1", 1)]);

  await runtime.flush();

  assert.equal(runtime.sync, "needs-review");
  assert.equal(runtime.pending, 0);
  assert.deepEqual(runtime.sheet?.cells, {});
});

test("a fault keeps the buffer at the front and reports error", async () => {
  const runtime = runtimeFor(50, 2000);
  wire.fault = true;
  runtime.apply([set("r1/c1", 1)]);

  await assert.rejects(() => runtime.flush(), /offline/);

  assert.equal(runtime.pending, 1);
  assert.equal(runtime.sync, "error");
});

test("undo buffers the inverse without recording a new gesture", async () => {
  const runtime = runtimeFor(50, 2000);
  runtime.apply([set("r1/c1", 5)]);
  await runtime.flush();

  runtime.undo();

  assert.equal(runtime.pending, 1);
  assert.equal(runtime.canUndo, false);
  assert.equal(runtime.canRedo, true);
});

test("undo then redo walks back and forward through the stacks", () => {
  const runtime = runtimeFor(50, 2000);
  runtime.apply([set("r1/c1", 1)]);
  runtime.apply([set("r2/c1", 2)]);

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
  runtime.apply([set("r1/c1", 1)]);
  runtime.undo();
  assert.equal(runtime.canRedo, true);

  runtime.apply([set("r2/c1", 2)]);

  assert.equal(runtime.canRedo, false);
});

test("undo survives a flush, because history is not the buffer", async () => {
  const runtime = runtimeFor(50, 2000);
  runtime.apply([set("r1/c1", 1)]);
  await runtime.flush();

  assert.equal(runtime.pending, 0);
  assert.equal(runtime.canUndo, true);
});

test("sync says loading until something lands, and the sheet stays undefined", () => {
  const runtime = runtimeFor();

  assert.equal(runtime.sync, "loading");
  assert.equal(runtime.sheet, undefined);
});

test("a sheet nobody has written opens on the empty grid", async () => {
  wire.readLands = true;
  const runtime = runtimeFor();

  await vi.advanceTimersByTimeAsync(0);

  assert.equal(runtime.sync, "saved");
  assert.equal(runtime.revision, 0);
  assert.ok((runtime.sheet?.body.rows.length ?? 0) > 0);
  assert.deepEqual(runtime.sheet?.cells, {});
});
