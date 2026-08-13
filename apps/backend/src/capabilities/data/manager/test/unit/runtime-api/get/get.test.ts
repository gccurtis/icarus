import assert from "node:assert/strict";
import { test } from "node:test";
import { createDataManager } from "#data-manager";

test("retrieves declarations under any casing of their authored name", () => {
  const manager = createDataManager();

  const scalar = manager.define({
    name: "TaxRate",
    type: { kind: "scalar", field: { name: "rate", type: { kind: "number" } } },
    value: 0.0825
  });
  const list = manager.define({
    name: "Regions",
    type: { kind: "list", field: { name: "region", type: { kind: "text" } } },
    value: ["north", "south"]
  });

  assert.deepEqual(manager.get("taxrate"), scalar);
  assert.deepEqual(manager.get("REGIONS"), list);
});

test("returns undefined for a name no declaration has claimed", () => {
  const manager = createDataManager();

  manager.define({
    name: "OrdersCopy",
    type: {
      kind: "scalar",
      field: { name: "value", type: { kind: "reference" } }
    },
    value: "  FutureOrders  "
  });

  assert.equal(manager.get("FutureOrders"), undefined);
});
