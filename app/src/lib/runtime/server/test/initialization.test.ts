import assert from "node:assert/strict";
import { test } from "vitest";
import { serverInitialization } from "$runtime/server/initialization.server";

test("repeated framework initialization joins one command before and after startup", async () => {
  let calls = 0;
  const initialize = serverInitialization(undefined, async () => { calls += 1; });
  const first = initialize();
  assert.equal(initialize(), first);
  await first;
  assert.equal(initialize(), first);
  assert.equal(calls, 1);
});

test("a replacement waits for release and owns its own initialization", async () => {
  const events: string[] = [];
  let release!: () => void;
  const outgoing = serverInitialization(undefined, async () => { events.push("outgoing"); });
  await outgoing();
  const released = new Promise<void>((resolve) => { release = resolve; });
  const incoming = serverInitialization(released, async () => { events.push("incoming"); });
  const starting = incoming();
  await Promise.resolve();
  assert.deepEqual(events, ["outgoing"]);
  release();
  await starting;
  assert.deepEqual(events, ["outgoing", "incoming"]);
});

test("failed startup stays failed for the same hook lifetime", async () => {
  let calls = 0;
  const failure = new Error("invalid configuration");
  const initialize = serverInitialization(undefined, async () => {
    calls += 1;
    throw failure;
  });
  await assert.rejects(initialize(), (error) => error === failure);
  await assert.rejects(initialize(), (error) => error === failure);
  assert.equal(calls, 1);
});

test("failed release cannot initialize an overlapping graph", async () => {
  let calls = 0;
  const failure = new Error("release failed");
  const initialize = serverInitialization(Promise.reject(failure), async () => { calls += 1; });
  await assert.rejects(initialize(), (error) => error === failure);
  assert.equal(calls, 0);
});
