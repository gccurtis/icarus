import assert from "node:assert/strict";
import { afterEach, beforeEach, test, vi } from "vitest";
import type { SlideDeckOp } from "$representation/data/types/revisions/slide-deck-op";
import { createConfiguration } from "$model/client/configuration";
import { createSlideDeckRuntimes } from "$model/client/slide-deck-runtimes";
import { Runtime } from "$model/client/slide-deck-runtimes/definition.svelte";
import { rebase } from "$model/client/slide-deck-runtimes/methods/flush/rebase";

const register = (afterOps = 50, afterMs = 2000) =>
  createSlideDeckRuntimes(
    createConfiguration({ revisions: { changeSets: { flushAfterOps: afterOps, flushAfterMs: afterMs } } })
  );

const set = (slide: string, value: number): SlideDeckOp => ({
  op: "set",
  target: "slide",
  path: `slides/#${slide}`,
  value,
  was: value - 1
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test("release submits what was buffered", async () => {
  const runtimes = register();
  const runtime = runtimes.attach("s1");
  runtime.apply([set("a", 1)]);

  runtimes.release("s1");
  await vi.runAllTimersAsync();

  assert.equal(runtime.pending, 0);
  assert.equal(runtime.revision, 1);
});

test("releaseAll submits every open buffer", async () => {
  const runtimes = register();
  const first = runtimes.attach("s1");
  const second = runtimes.attach("s2");
  first.apply([set("a", 1)]);
  second.apply([set("b", 2)]);

  runtimes.releaseAll();
  await vi.runAllTimersAsync();

  assert.equal(first.pending, 0);
  assert.equal(second.pending, 0);
  assert.deepEqual(runtimes.open, []);
});

test("a released runtime leaves the register once its submit settles", async () => {
  const runtimes = register();
  const runtime = runtimes.attach("s1");
  runtime.apply([set("a", 1)]);

  runtimes.release("s1");
  await vi.runAllTimersAsync();

  assert.deepEqual(runtimes.open, []);
  assert.deepEqual(runtimes.flushing, []);
});

test("release cancels the pending debounce rather than leaving a timer behind", async () => {
  const runtimes = register(50, 2000);
  const runtime = runtimes.attach("s1");
  runtime.apply([set("a", 1)]);

  runtimes.release("s1");
  await vi.runAllTimersAsync();
  const revisionAfterRelease = runtime.revision;

  await vi.advanceTimersByTimeAsync(10_000);

  assert.equal(runtime.revision, revisionAfterRelease);
  assert.equal(vi.getTimerCount(), 0);
});

test("closing the client instance releases every runtime", async () => {
  const runtimes = register();
  runtimes.attach("s1");
  runtimes.attach("s2");

  runtimes.releaseAll();
  await vi.runAllTimersAsync();

  assert.deepEqual(runtimes.open, []);
});

test("a refused change set goes back to the front of the buffer", () => {
  const runtime = new Runtime("s1", { afterOps: 50, afterMs: 2000 });
  runtime.buffer = [set("typed-during-flight", 9)];

  rebase(runtime, [set("refused", 1)], { revision: 7, retryable: true });

  assert.equal(runtime.buffer.length, 2);
  assert.equal(runtime.buffer[0].path, "slides/#refused");
  assert.equal(runtime.buffer[1].path, "slides/#typed-during-flight");
});

test("a rebase adopts the server's revision", () => {
  const runtime = new Runtime("s1", { afterOps: 50, afterMs: 2000 });

  rebase(runtime, [set("a", 1)], { revision: 42, retryable: true });

  assert.equal(runtime.revision, 42);
  assert.equal(runtime.sync, "rebasing");
});

test("a refusal the ladder cannot resolve needs review, and keeps the work", () => {
  const runtime = new Runtime("s1", { afterOps: 50, afterMs: 2000 });

  rebase(runtime, [set("a", 1)], { revision: 42, retryable: false });

  assert.equal(runtime.sync, "needs-review");
  assert.equal(runtime.buffer.length, 1);
});

test("a runtime that cannot submit keeps reporting rather than disappearing", () => {
  const runtimes = register();
  const runtime = runtimes.attach("s1") as unknown as Runtime;
  runtime.apply([set("a", 1)]);
  runtime.sync = "error";

  assert.equal(runtime.pending, 1);
  assert.equal(runtime.sync, "error");
});
