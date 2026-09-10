import assert from "node:assert/strict";
import { test } from "vitest";

import { createConfiguration } from "$model/client/configuration";
import { createTabList } from "$model/client/tab-list";
import { createTabViews } from "$model/client/tab-views";
import { createWorkspaceState, type WorkspaceStateModel } from "$model/client/workspace-state";

const UNPERSISTED = { workspace: { changeSets: { flushAfterOps: 0, flushAfterMs: 0 } } };

const workspace = (): WorkspaceStateModel =>
  createWorkspaceState(
    "project-one",
    createTabList(),
    createTabViews(),
    createConfiguration(UNPERSISTED)
  );

const deferred = <Value>() => {
  let resolve!: (value: Value) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((accept, refuse) => {
    resolve = accept;
    reject = refuse;
  });
  return { promise, resolve, reject };
};

test("one pending durable intent runs once and shares its promise", async () => {
  const view = workspace();
  const held = deferred<number>();
  let calls = 0;
  const run = () => {
    calls += 1;
    return held.promise;
  };

  const first = view.singleFlight(["template", "t1", "instantiate"], run);
  const second = view.singleFlight(["template", "t1", "instantiate"], run);

  assert.equal(first, second);
  assert.equal(view.pendingFlight(["template", "t1", "instantiate"]), first);
  assert.equal(view.pendingFlight(["template", "t2", "instantiate"]), undefined);
  held.resolve(42);
  assert.deepEqual(await Promise.all([first, second]), [42, 42]);
  await Promise.resolve();
  assert.equal(view.pendingFlight(["template", "t1", "instantiate"]), undefined);
  assert.equal(calls, 1);
});

test("different durable intents can proceed together", async () => {
  const view = workspace();
  const first = deferred<string>();
  const second = deferred<string>();
  let calls = 0;

  const a = view.singleFlight(["template", "t1", "update", 1, "name", "A"], () => {
    calls += 1;
    return first.promise;
  });
  const b = view.singleFlight(["template", "t1", "update", 1, "name", "B"], () => {
    calls += 1;
    return second.promise;
  });

  await Promise.resolve();
  assert.equal(calls, 2);
  first.resolve("a");
  second.resolve("b");
  assert.deepEqual(await Promise.all([a, b]), ["a", "b"]);
});

test("settlement releases a key for success and failure retries", async () => {
  const view = workspace();
  let successes = 0;
  assert.equal(
    await view.singleFlight(["resource", "create", "document"], () =>
      Promise.resolve(++successes)
    ),
    1
  );
  assert.equal(
    await view.singleFlight(["resource", "create", "document"], () =>
      Promise.resolve(++successes)
    ),
    2
  );

  const failed = deferred<never>();
  let failures = 0;
  const first = view.singleFlight(["template", "t1", "remove", 1], () => {
    failures += 1;
    return failed.promise;
  });
  const duplicate = view.singleFlight(["template", "t1", "remove", 1], () => {
    failures += 1;
    return Promise.reject(new Error("must not run"));
  });

  failed.reject(new Error("failed once"));
  await assert.rejects(first, /failed once/);
  await assert.rejects(duplicate, /failed once/);
  assert.equal(failures, 1);

  assert.equal(
    await view.singleFlight(["template", "t1", "remove", 1], () =>
      Promise.resolve("retried")
    ),
    "retried"
  );
});

test("registration precedes synchronous work and captures a synchronous throw", async () => {
  const view = workspace();
  let reentered: Promise<string> | undefined;
  let calls = 0;

  const first = view.singleFlight(["template", "t1", "duplicate"], () => {
    calls += 1;
    reentered = view.singleFlight(["template", "t1", "duplicate"], () => {
      calls += 1;
      return Promise.resolve("wrong");
    });
    return Promise.resolve("copy");
  });

  await Promise.resolve();
  assert.equal(reentered, first);
  assert.equal(await first, "copy");
  assert.equal(calls, 1);

  await assert.rejects(
    view.singleFlight(["template", "t2", "duplicate"], () => {
      throw new Error("did not start");
    }),
    /did not start/
  );
  assert.equal(
    await view.singleFlight(["template", "t2", "duplicate"], () =>
      Promise.resolve("retry")
    ),
    "retry"
  );
});
