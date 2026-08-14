import assert from "node:assert/strict";
import { test } from "node:test";
import { createNameManager } from "#name-manager";
import { silentLogger } from "#name-manager/test/fixture.js";

test("retrieves declarations under any casing of their authored name", () => {
  const manager = createNameManager(silentLogger);

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
  const manager = createNameManager(silentLogger);

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
