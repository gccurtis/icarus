import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { get } from "$settings/api/get/get";
import { set } from "$settings/api/set/set";
import { SettingsError } from "$settings/errors";
import { installDatabases, scopeFor } from "$settings/test/fixture";

vi.mock(
  "$runtime/server/index.server",
  async () => (await import("$settings/test/stub")).serverStub()
);

installDatabases();

const scope = scopeFor("project-a");

test("returns what set stored", async () => {
  await set(scope, { key: "theme", value: "dark" });

  const current = await get(scope, "theme");

  assert.equal(current?.key, "theme");
  assert.equal(current?.value, "dark");
});

test("an absent key is an ordinary answer", async () => {
  assert.equal(await get(scope, "never.written"), undefined);
});

test("an unusable key is not, and still fails", async () => {
  // The distinction the caller should not have to make itself: something that
  // cannot exist is a different event from something that merely does not.
  await assert.rejects(
    () => get(scope, "Not A Key"),
    (error: unknown) => error instanceof SettingsError && error.code === "invalid-key"
  );
});

test("admits exactly what set admits", async () => {
  // The invariant that earns canonicalKey its place in shared/. If these two
  // ever disagreed, a caller could write a setting it could never read back.
  await set(scope, { key: "  theme  ", value: "dark" });

  assert.equal((await get(scope, "theme"))?.value, "dark");
  assert.equal((await get(scope, "  theme  "))?.value, "dark");
});

test("each caller gets its own copy of the value", async () => {
  await set(scope, { key: "editor", value: { font: { size: 14 } } });

  const first = (await get(scope, "editor"))?.value as { font: { size: number } };
  first.font.size = 99;

  const second = (await get(scope, "editor"))?.value;
  assert.deepEqual(second, { font: { size: 14 } });
});
