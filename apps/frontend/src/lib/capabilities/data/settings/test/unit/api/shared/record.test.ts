import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { record } from "$settings/api/shared/record";
import { SettingsError } from "$settings/errors";
import { stub } from "$settings/test/stub";

vi.mock(
  "$runtime/server/index.server",
  async () => (await import("$settings/test/stub")).serverStub()
);

const fresh = (): void => {
  stub.records.length = 0;
};

test("brackets a successful call with started and completed", async () => {
  fresh();

  const result = await record("set", { key: "theme" }, async () => "done");

  assert.equal(result, "done");
  assert.deepEqual(
    stub.records.map((line) => line.message),
    ["settings.set.started", "settings.set.completed"]
  );
});

test("a stated decision is a warning, and carries its code", async () => {
  fresh();

  await assert.rejects(() =>
    record("set", { key: "theme" }, async () => {
      throw new SettingsError("invalid-key", "no");
    })
  );

  const last = stub.records.at(-1);
  assert.equal(last?.level, "warn");
  assert.equal(last?.message, "settings.set.rejected");
  assert.deepEqual(last?.data, { key: "theme", errorCode: "invalid-key" });
});

test("anything else is a fault, and reads as one", async () => {
  // The distinction that keeps real bugs visible: if every ordinary rejection
  // were logged at error, nothing at error would mean anything.
  fresh();

  await assert.rejects(() =>
    record("set", { key: "theme" }, async () => {
      throw new TypeError("undefined is not a function");
    })
  );

  const last = stub.records.at(-1);
  assert.equal(last?.level, "error");
  assert.equal(last?.message, "settings.set.failed");
  assert.deepEqual(last?.data, {
    key: "theme",
    errorName: "TypeError",
    errorMessage: "undefined is not a function"
  });
});

test("the original error reaches the caller unchanged", async () => {
  fresh();

  const thrown = new SettingsError("invalid-value", "no");
  await assert.rejects(
    () =>
      record("set", {}, async () => {
        throw thrown;
      }),
    (error: unknown) => error === thrown
  );
});
