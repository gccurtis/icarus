import assert from "node:assert/strict";
import { afterEach, beforeEach, test, vi } from "vitest";
import type { DocumentOp } from "$representation/data/types/documents/op";
import { createConfiguration } from "$model/client/configuration";
import { createDocumentRuntimes } from "$model/client/document-runtimes";
import type { DocumentRuntime } from "$model/client/document-runtimes";

const wire = vi.hoisted(() => ({
  refusals: 0,
  fault: false,
  readLands: false,
  sent: [] as { baseRevision: number; ops: unknown[]; touched: string[] }[]
}));

vi.mock("$capabilities/document/index.remote", () => ({
  readDocumentBody: () =>
    Object.assign(wire.readLands ? Promise.resolve(null) : new Promise(() => {}), {
      refresh: () => Promise.resolve(),
      ready: false
    }),
  submitDocumentChanges: ({
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

const runtimeFor = (afterOps = 3, afterMs = 2000): DocumentRuntime =>
  createDocumentRuntimes(
    createConfiguration({
      revisions: {
        changeSets: { flushAfterOps: afterOps, flushAfterMs: afterMs },
        sync: { everyMs: 0 }
      }
    })
  ).attach("k57");

const set = (row: string, value: number): DocumentOp => ({
  op: "set",
  target: "row",
  path: `rows/#${row}`,
  value,
  was: value - 1
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

  runtime.apply([set("r1", 1)]);

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

  runtime.apply([set("r1", 1), set("r2", 2), set("r3", 3)]);

  assert.equal(runtime.canUndo, true);
  runtime.undo();
  assert.equal(runtime.canUndo, false);
});

test("reaching the op threshold submits", async () => {
  const runtime = runtimeFor(3);

  runtime.apply([set("r1", 1), set("r2", 2), set("r3", 3)]);
  await vi.runAllTimersAsync();

  assert.equal(runtime.pending, 0);
  assert.equal(runtime.sync, "saved");
  assert.equal(runtime.revision, 1);
});

test("stopping submits on the clock", async () => {
  const runtime = runtimeFor(50, 2000);

  runtime.apply([set("r1", 1)]);
  assert.equal(runtime.pending, 1);

  await vi.advanceTimersByTimeAsync(2000);

  assert.equal(runtime.pending, 0);
  assert.equal(runtime.sync, "saved");
});

test("the debounce measures from the last op, not the first", () => {
  const runtime = runtimeFor(50, 2000);

  runtime.apply([set("r1", 1)]);
  vi.advanceTimersByTime(1500);
  runtime.apply([set("r2", 2)]);
  vi.advanceTimersByTime(1500);

  assert.equal(runtime.pending, 2);
});

test("a flush advances the revision and empties the buffer", async () => {
  const runtime = runtimeFor();
  runtime.apply([set("r1", 1)]);

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
  runtime.apply([set("r1", 1)]);

  await Promise.all([runtime.flush(), runtime.flush(), runtime.flush()]);

  assert.equal(runtime.revision, 1);
});

test("ops applied during a flush survive for the next one", async () => {
  const runtime = runtimeFor(50, 2000);
  runtime.apply([set("r1", 1)]);

  const inFlight = runtime.flush();
  runtime.apply([set("r2", 2)]);
  await inFlight;

  assert.equal(runtime.pending, 1);
});

test("undo buffers the inverse without recording a new gesture", async () => {
  const runtime = runtimeFor(50, 2000);
  runtime.apply([set("r1", 5)]);
  await runtime.flush();

  runtime.undo();

  assert.equal(runtime.pending, 1);
  assert.equal(runtime.canUndo, false);
  assert.equal(runtime.canRedo, true);
});

test("undo then redo walks back and forward through the stacks", () => {
  const runtime = runtimeFor(50, 2000);
  runtime.apply([set("r1", 1)]);
  runtime.apply([set("r2", 2)]);

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
  runtime.apply([set("r1", 1)]);
  runtime.undo();
  assert.equal(runtime.canRedo, true);

  runtime.apply([set("r2", 2)]);

  assert.equal(runtime.canRedo, false);
});

test("undo survives a flush, because history is not the buffer", async () => {
  const runtime = runtimeFor(50, 2000);
  runtime.apply([set("r1", 1)]);
  await runtime.flush();

  assert.equal(runtime.pending, 0);
  assert.equal(runtime.canUndo, true);
});

test("sync says loading until something lands, and body stays undefined", () => {
  const runtime = runtimeFor();

  assert.equal(runtime.sync, "loading");
  assert.equal(runtime.body, undefined);
});

test("what goes over the wire is a change set, not a bag of ops", async () => {
  const runtime = runtimeFor();
  runtime.apply([set("r1", 1), set("r2", 2)]);

  await runtime.flush();

  assert.equal(wire.sent.length, 1);
  assert.equal(wire.sent[0].baseRevision, 0);
  assert.deepEqual(wire.sent[0].touched, ["rows/#r1", "rows/#r2"]);
});

test("a stale refusal is rebased once and resubmitted", async () => {
  wire.refusals = 1;
  const runtime = runtimeFor();
  runtime.apply([set("r1", 1)]);

  await runtime.flush();

  assert.equal(wire.sent.length, 2);
  assert.equal(wire.sent[0].baseRevision, 0);
  assert.equal(wire.sent[1].baseRevision, 4);
  assert.equal(runtime.sync, "saved");
  assert.equal(runtime.pending, 0);
});

test("a refusal the rebase cannot resolve drops the ops and reads the body back", async () => {
  wire.refusals = 2;
  wire.readLands = true;
  const runtime = runtimeFor();
  runtime.apply([set("r1", 1)]);

  await runtime.flush();

  assert.equal(runtime.sync, "needs-review");
  assert.equal(runtime.pending, 0);
  assert.notEqual(runtime.body, undefined);
});

test("a refusal that arrives is not a fault that throws", async () => {
  wire.refusals = 2;
  wire.readLands = true;
  const runtime = runtimeFor();
  runtime.apply([set("r1", 1)]);

  await assert.doesNotReject(() => runtime.flush());
});

test("a fault puts the ops back and reports an error", async () => {
  wire.fault = true;
  const runtime = runtimeFor();
  runtime.apply([set("r1", 1)]);

  await assert.rejects(() => runtime.flush());

  assert.equal(runtime.sync, "error");
  assert.equal(runtime.pending, 1);
});
