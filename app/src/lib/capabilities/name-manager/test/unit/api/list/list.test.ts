import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { define } from "$name-manager/api/define/define";
import { list } from "$name-manager/api/list/list";
import { installDatabases, scopeFor } from "$name-manager/test/fixture";
import type { NamedVariableInput } from "$name-manager/types/variables";

vi.mock(
  "$model/server/index.server",
  async () => (await import("$name-manager/test/stub")).serverStub()
);

installDatabases(["project-a", "project-b"]);

const scope = scopeFor("project-a");
const other = scopeFor("project-b");

const scalarNamed = (name: string): NamedVariableInput => ({
  name,
  type: { kind: "scalar", field: { name: "value", type: { kind: "number" } } },
  value: 1
});

test("an empty catalog is an empty array, not a refusal", async () => {
  assert.deepEqual(await list(scope), []);
});

test("returns every declaration in definition order", async () => {
  // Not alphabetical: a catalog is read as a record of what was declared and
  // when, and a caller that wanted this order could not recover it if the
  // function had never preserved it.
  for (const name of ["TaxRate", "Regions", "Customer", "Alpha"]) {
    await define(scope, scalarNamed(name));
  }

  assert.deepEqual(
    (await list(scope)).map(({ name }) => name),
    ["TaxRate", "Regions", "Customer", "Alpha"]
  );
});

test("a refused definition takes no position in the order", async () => {
  await define(scope, scalarNamed("First"));
  await assert.rejects(() => define(scope, scalarNamed("not valid")));
  await define(scope, scalarNamed("Second"));

  assert.deepEqual(
    (await list(scope)).map(({ name }) => name),
    ["First", "Second"]
  );
});

test("two projects cannot see each other's catalogs", async () => {
  // Structural rather than a predicate this capability remembered to write:
  // these are two databases, so there is no cross-project reach to forget.
  await define(scope, scalarNamed("OnlyInA"));
  await define(other, scalarNamed("OnlyInB"));

  assert.deepEqual(
    (await list(scope)).map(({ name }) => name),
    ["OnlyInA"]
  );
  assert.deepEqual(
    (await list(other)).map(({ name }) => name),
    ["OnlyInB"]
  );
});
