import assert from "node:assert/strict";
import { test } from "vitest";
import {
  ownProcessLifetime,
  type ProcessShutdownChannel
} from "$runtime/server/lifetime.server";

const shutdownChannel = (initial: readonly (() => void)[] = []) => {
  const listeners = new Set(initial);
  const channel: ProcessShutdownChannel = {
    listeners: () => [...listeners],
    add: (listener) => {
      listeners.add(listener);
    },
    remove: (listener) => {
      listeners.delete(listener);
    }
  };
  return { channel, listeners };
};

test("successive owners replace one listener and preserve unrelated listeners", async () => {
  const unrelated = () => {};
  const { channel, listeners } = shutdownChannel([unrelated]);
  const releases: number[] = [];
  const shutdowns: number[] = [];
  const failures: unknown[] = [];

  for (let owner = 0; owner < 12; owner += 1) {
    const outgoingRelease = ownProcessLifetime(
      channel,
      async () => {
        releases.push(owner);
      },
      async () => {
        shutdowns.push(owner);
      },
      (error) => failures.push(error)
    );

    assert.equal(listeners.size, 2);
    assert.equal(listeners.has(unrelated), true);
    await outgoingRelease;
  }

  assert.deepEqual(releases, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(shutdowns, []);
  assert.deepEqual(failures, []);
});

test("terminal shutdown waits for the outgoing owner and bypasses development release", async () => {
  const { channel, listeners } = shutdownChannel();
  const transitions: string[] = [];
  let allowRelease!: () => void;
  let observeShutdown!: () => void;
  const releaseGate = new Promise<void>((resolve) => {
    allowRelease = resolve;
  });
  const shutdownObserved = new Promise<void>((resolve) => {
    observeShutdown = resolve;
  });

  ownProcessLifetime(
    channel,
    async () => {
      transitions.push("outgoing release started");
      await releaseGate;
      transitions.push("outgoing release finished");
    },
    async () => {
      transitions.push("outgoing shutdown");
    },
    () => {}
  );

  const pendingRelease = ownProcessLifetime(
    channel,
    async () => {
      transitions.push("incoming release");
    },
    async () => {
      transitions.push("incoming shutdown");
      observeShutdown();
    },
    () => {}
  );
  await Promise.resolve();
  assert.deepEqual(transitions, ["outgoing release started"]);

  const listener = [...listeners][0];
  assert.ok(listener);
  listener();
  allowRelease();
  await Promise.all([pendingRelease, shutdownObserved]);

  assert.deepEqual(transitions, [
    "outgoing release started",
    "outgoing release finished",
    "incoming shutdown"
  ]);
});

test("a terminal failure is reported once", async () => {
  const { channel, listeners } = shutdownChannel();
  const failure = new Error("shutdown failed");
  let shutdowns = 0;
  const failures: unknown[] = [];
  const reported = new Promise<unknown>((resolve) => {
    ownProcessLifetime(
      channel,
      async () => {},
      async () => {
        shutdowns += 1;
        throw failure;
      },
      (error) => {
        failures.push(error);
        resolve(error);
      }
    );
  });

  const listener = [...listeners][0];
  assert.ok(listener);
  listener();
  listener();

  assert.equal(await reported, failure);
  assert.equal(shutdowns, 1);
  assert.deepEqual(failures, [failure]);
});
