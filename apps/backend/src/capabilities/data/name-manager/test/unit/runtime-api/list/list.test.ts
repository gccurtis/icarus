import assert from "node:assert/strict";
import { test } from "node:test";
import { testNameManager } from "#name-manager/test/fixture.js";

test("returns every declaration in definition order", async () => {
  const manager = testNameManager();

  await manager.define({
    name: "TaxRate",
    type: { kind: "scalar", field: { name: "rate", type: { kind: "number" } } },
    value: 0.0825
  });
  await manager.define({
    name: "Regions",
    type: { kind: "list", field: { name: "region", type: { kind: "text" } } },
    value: ["north", "south"]
  });
  await manager.define({
    name: "Customer",
    type: {
      kind: "record",
      fields: [
        { name: "name", type: { kind: "text" } },
        { name: "active", type: { kind: "logic" } }
      ]
    },
    value: { name: "Ada", active: true }
  });
  await manager.define({
    name: "Customers",
    type: {
      kind: "table",
      fields: [
        { name: "name", type: { kind: "text" } },
        { name: "active", type: { kind: "logic" } }
      ]
    },
    value: [
      { name: "Ada", active: true },
      { name: "Grace", active: false }
    ]
  });

  const listed = await manager.list();

  assert.equal(listed.length, 4);
  assert.deepEqual(
    listed.map(({ name }) => name),
    ["TaxRate", "Regions", "Customer", "Customers"]
  );
});
