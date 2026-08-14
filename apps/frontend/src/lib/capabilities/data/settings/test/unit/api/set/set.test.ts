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

const scope = scopeFor("project-a", "ada");

test("writes a value and reports what was stored", async () => {
  const stored = await set(scope, { key: "editor.theme", value: "dark" });

  assert.equal(stored.key, "editor.theme");
  assert.equal(stored.value, "dark");
  assert.ok(stored.updatedAt instanceof Date);
});

test("records the acting user from the scope, which no input can supply", async () => {
  // The smallest demonstration that authority comes from the session rather
  // than the caller. If a browser could put a user id in the payload, this
  // column would be a record of what someone claimed.
  const stored = await set(scope, { key: "theme", value: "dark" });
  assert.equal(stored.updatedBy, "ada");

  const byOther = await set(scopeFor("project-a", "grace"), {
    key: "theme",
    value: "light"
  });
  assert.equal(byOther.updatedBy, "grace");
});

test("replaces rather than duplicating, and the last writer wins", async () => {
  await set(scope, { key: "theme", value: "dark" });
  await set(scope, { key: "theme", value: "light" });

  const current = await get(scope, "theme");
  assert.equal(current?.value, "light");
});

test("stores structure, not a string of it", async () => {
  await set(scope, { key: "editor", value: { font: { size: 14 }, tabs: [2, 4] } });

  // Read back through a fresh query: this asserts the jsonb round trip, which
  // is the thing a fake store could never have covered.
  const current = await get(scope, "editor");
  assert.deepEqual(current?.value, { font: { size: 14 }, tabs: [2, 4] });
});

test("rejects a bad key before touching the database", async () => {
  await assert.rejects(
    () => set(scope, { key: "Not A Key", value: 1 }),
    (error: unknown) => error instanceof SettingsError && error.code === "invalid-key"
  );

  assert.equal(await get(scope, "theme"), undefined);
});

test("rejects a bad value before touching the database", async () => {
  await assert.rejects(
    () => set(scope, { key: "theme", value: undefined as never }),
    (error: unknown) => error instanceof SettingsError && error.code === "invalid-value"
  );

  assert.equal(await get(scope, "theme"), undefined);
});

test("what a caller mutates afterwards does not reach the row", async () => {
  const value = { font: { size: 14 } };
  await set(scope, { key: "editor", value });
  value.font.size = 99;

  const current = await get(scope, "editor");
  assert.deepEqual(current?.value, { font: { size: 14 } });
});
