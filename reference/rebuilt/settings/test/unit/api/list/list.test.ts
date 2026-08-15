import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { get } from "$settings/api/get/get";
import { list } from "$settings/api/list/list";
import { set } from "$settings/api/set/set";
import { installDatabases, scopeFor } from "$settings/test/fixture";

vi.mock(
  "$model/server/index.server",
  async () => (await import("$settings/test/stub")).serverStub()
);

// Two projects, two real databases. The isolation assertion below is the reason
// this file pays for a second PGlite instance.
installDatabases(["alpha", "beta"]);

const alpha = scopeFor("alpha");
const beta = scopeFor("beta");

test("returns nothing for an untouched project", async () => {
  assert.deepEqual(await list(alpha), []);
});

test("returns every key, in key order rather than write order", async () => {
  await set(alpha, { key: "theme", value: "dark" });
  await set(alpha, { key: "editor.font-size", value: 14 });
  await set(alpha, { key: "a11y.contrast", value: "high" });

  assert.deepEqual(
    (await list(alpha)).map((setting) => setting.key),
    ["a11y.contrast", "editor.font-size", "theme"]
  );
});

test("a project cannot see another project's settings", async () => {
  // The property the whole per-project registry exists to buy. It holds without
  // a predicate anywhere in this capability — there is no `where project_id`
  // to have been forgotten, because there is no column to forget.
  await set(alpha, { key: "theme", value: "dark" });
  await set(beta, { key: "theme", value: "light" });

  assert.equal((await get(alpha, "theme"))?.value, "dark");
  assert.equal((await get(beta, "theme"))?.value, "light");

  assert.deepEqual((await list(alpha)).map((s) => s.value), ["dark"]);
  assert.deepEqual((await list(beta)).map((s) => s.value), ["light"]);
});

test("the same key in two projects is two rows, not a conflict", async () => {
  await set(alpha, { key: "theme", value: "dark" });
  await set(beta, { key: "theme", value: "light" });

  assert.equal((await list(alpha)).length, 1);
  assert.equal((await list(beta)).length, 1);
});
