import assert from "node:assert/strict";
import { test } from "node:test";
import { testNameManager } from "#name-manager/test/fixture.js";

test("retrieves declarations under any casing of their authored name", async () => {
  const manager = testNameManager();

  const scalar = await manager.define({
    name: "TaxRate",
    type: { kind: "scalar", field: { name: "rate", type: { kind: "number" } } },
    value: 0.0825
  });
  const list = await manager.define({
    name: "Regions",
    type: { kind: "list", field: { name: "region", type: { kind: "text" } } },
    value: ["north", "south"]
  });

  assert.deepEqual(await manager.get("taxrate"), scalar);
  assert.deepEqual(await manager.get("REGIONS"), list);
});

test("returns undefined for a name no declaration has claimed", async () => {
  const manager = testNameManager();

  await manager.define({
    name: "OrdersCopy",
    type: {
      kind: "scalar",
      field: { name: "value", type: { kind: "reference" } }
    },
    value: "  FutureOrders  "
  });

  assert.equal(await manager.get("FutureOrders"), undefined);
});
