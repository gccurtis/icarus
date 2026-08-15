import assert from "node:assert/strict";
import { test } from "vitest";
import { createStorage } from "$model/client/storage";
import type { PersistedWorkbench } from "$model/client/storage";
import { STORAGE_VERSION } from "$model/client/storage/types";

/**
 * Write coalescing, which is the whole of what the definition owns beyond a
 * document.
 *
 * It is invisible in the code — a flag and a `queueMicrotask` read as an
 * implementation detail until you know that opening a tab touches the tab list
 * and the active ref, so one user action would otherwise cost two serializations
 * and two writes.
 */

/** A sink that keeps every write, so a test can count them rather than infer. */
const recording = () => {
  const writes: string[] = [];
  return { writes, sink: (serialized: string) => writes.push(serialized) };
};

const workbench = (id: string): PersistedWorkbench => ({
  tabs: [["project-overview", id]],
  active: ["project-overview", id]
});

const settled = () => new Promise<void>((resolve) => queueMicrotask(resolve));

test("a burst of writes in one turn costs one serialization", async () => {
  const { writes, sink } = recording();
  const storage = createStorage({ v: STORAGE_VERSION }, sink);

  storage.saveWorkbench(workbench("a"));
  storage.saveWorkbench(workbench("b"));
  storage.saveWorkbench(workbench("c"));

  // Nothing has been written yet: the write is scheduled, not performed.
  assert.equal(writes.length, 0);

  await settled();

  assert.equal(writes.length, 1, "each save scheduled its own write");
  // The last document wins, because each save replaces the section whole.
  assert.match(writes[0], /"c"/);
});

test("a later turn schedules a new write", async () => {
  const { writes, sink } = recording();
  const storage = createStorage({ v: STORAGE_VERSION }, sink);

  storage.saveWorkbench(workbench("a"));
  await settled();
  storage.saveWorkbench(workbench("b"));
  await settled();

  assert.equal(writes.length, 2, "the flag did not reset after the first flush");
});

test("reads come back from the document, before anything is flushed", () => {
  const { sink } = recording();
  const storage = createStorage({ v: STORAGE_VERSION }, sink);

  storage.saveWorkbench(workbench("a"));

  // The document is assigned synchronously; only the write is deferred. A reader
  // that had to wait for the microtask would see the previous value.
  assert.equal(storage.workbench?.tabs[0][1], "a");
});

test("every write carries the whole document", async () => {
  // Whole rather than incremental, so a store damaged by hand or written by an
  // older build is repaired by the next mutation.
  const { writes, sink } = recording();
  const storage = createStorage({ v: STORAGE_VERSION }, sink);

  storage.saveWorkbench(workbench("a"));
  await settled();

  assert.deepEqual(JSON.parse(writes[0]), {
    v: STORAGE_VERSION,
    workbench: { tabs: [["project-overview", "a"]], active: ["project-overview", "a"] }
  });
});

test("two instances hold their own documents and their own sinks", () => {
  const first = recording();
  const second = recording();

  createStorage({ v: STORAGE_VERSION }, first.sink).saveWorkbench(workbench("a"));
  const other = createStorage({ v: STORAGE_VERSION }, second.sink);

  assert.equal(other.workbench, undefined, "the second saw the first's document");
});
