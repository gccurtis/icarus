import assert from "node:assert/strict";
import { test } from "node:test";
import { NameManagerError } from "#name-manager";
import { persistentFixture } from "#name-manager/test/fixture.js";

test("declarations survive runtime reconstruction with their authored shapes", async (context) => {
  const { runtime, runtimeFor } = await persistentFixture(context);
  const declarations = [
    {
      name: "TaxRate",
      type: { kind: "scalar", field: { name: "rate", type: { kind: "number" } } },
      value: 0.0825
    },
    {
      name: "Regions",
      type: { kind: "list", field: { name: "region", type: { kind: "text" } } },
      value: ["north", "south"]
    },
    {
      name: "ReleaseDate",
      type: { kind: "record", fields: [
        { name: "date", type: { kind: "date" } },
        { name: "formula", type: { kind: "formula" } },
        { name: "source", type: { kind: "reference" } }
      ] },
      value: {
        date: { calendar: "gregorian", day: 12, month: 8, year: 2026 },
        formula: "subtotal * rate",
        source: "  FutureOrders  "
      }
    },
    {
      name: "Accounts",
      type: { kind: "table", fields: [
        { name: "id", type: { kind: "number" } },
        {
          name: "settings",
          type: {
            kind: "record",
            fields: [{ name: "enabled", type: { kind: "logic" } }]
          }
        }
      ] },
      value: [{ id: 1, settings: { enabled: true } }]
    }
  ] as const;

  const expected = [];
  for (const declaration of declarations) {
    expected.push(await runtime.define(declaration));
  }

  const reconstructed = await runtimeFor("project-a");
  assert.deepEqual(await reconstructed.list(), expected);
  assert.equal((await reconstructed.require("releasedate")).name, "ReleaseDate");
});

test("project namespaces are isolated and preserve their own definition order", async (context) => {
  const { runtime: firstProject, runtimeFor } = await persistentFixture(context);
  const secondProject = await runtimeFor("project-b");
  const scalar = (name: string, value: number) => ({
    name,
    type: { kind: "scalar" as const, field: { name: "value", type: { kind: "number" as const } } },
    value
  });

  await firstProject.define(scalar("Second", 2));
  await firstProject.define(scalar("First", 1));
  assert.equal(await secondProject.get("Second"), undefined);
  await secondProject.define(scalar("Second", 22));

  assert.deepEqual(
    (await (await runtimeFor("project-a")).list()).map(({ name }) => name),
    ["Second", "First"]
  );
  assert.deepEqual(
    (await secondProject.list()).map(({ name, value }) => [name, value]),
    [["Second", 22]]
  );
});

test("the database unique key admits only one concurrent case-insensitive definition", async (context) => {
  const { runtime, runtimeFor } = await persistentFixture(context);
  const competingRuntime = await runtimeFor("project-a");
  const define = (manager: typeof runtime, name: string, value: number) =>
    manager.define({
      name,
      type: { kind: "scalar", field: { name: "value", type: { kind: "number" } } },
      value
    });

  const outcomes = await Promise.allSettled([
    define(runtime, "SharedName", 1),
    define(competingRuntime, "sharedname", 2)
  ]);
  const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled");
  const rejected = outcomes.filter((outcome) => outcome.status === "rejected");

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.ok(
    rejected[0]?.status === "rejected" &&
      rejected[0].reason instanceof NameManagerError &&
      rejected[0].reason.code === "name-conflict"
  );
  assert.equal((await runtime.list()).length, 1);
});

test("persisted reads do not expose stored mutable state", async (context) => {
  const { runtime } = await persistentFixture(context);
  await runtime.define({
    name: "Rows",
    type: { kind: "table", fields: [{ name: "value", type: { kind: "number" } }] },
    value: [{ value: 1 }]
  });

  const read = await runtime.require("Rows");
  (read.value as Array<{ value: number }>)[0]!.value = 99;

  assert.deepEqual((await runtime.require("Rows")).value, [{ value: 1 }]);
});
