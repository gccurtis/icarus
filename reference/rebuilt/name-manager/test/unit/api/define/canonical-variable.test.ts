import assert from "node:assert/strict";
import { test } from "vitest";
import { canonicalVariable } from "$name-manager/api/define/canonical-variable";
import { NameManagerError } from "$name-manager/errors";
import type { NamedVariableInput } from "$name-manager/types/variables";

/**
 * Tier one: the whole admission tree, without a database.
 *
 * This is `define`'s admission half, which the backend could only exercise
 * through a runtime object over a fake store. It is 368 lines of pure functions
 * and it is now callable directly.
 */
const code = (expected: string) => (error: unknown): boolean =>
  error instanceof NameManagerError && error.code === expected;

const admit = (input: unknown) => canonicalVariable(input as NamedVariableInput);

test("admits each table shape without wrapping scalar or list fields", () => {
  assert.equal(
    admit({
      name: "TaxRate",
      type: { kind: "scalar", field: { name: "rate", type: { kind: "number" } } },
      value: 0.0825
    }).value,
    0.0825
  );

  assert.deepEqual(
    admit({
      name: "Regions",
      type: { kind: "list", field: { name: "region", type: { kind: "text" } } },
      value: ["north", "south"]
    }).value,
    ["north", "south"]
  );

  assert.deepEqual(
    admit({
      name: "Customer",
      type: {
        kind: "record",
        fields: [
          { name: "name", type: { kind: "text" } },
          { name: "active", type: { kind: "logic" } }
        ]
      },
      value: { name: "Ada", active: true }
    }).value,
    { name: "Ada", active: true }
  );

  assert.deepEqual(
    admit({
      name: "Customers",
      type: { kind: "table", fields: [{ name: "name", type: { kind: "text" } }] },
      value: [{ name: "Ada" }, { name: "Grace" }]
    }).value,
    [{ name: "Ada" }, { name: "Grace" }]
  );
});

test("refuses a bare scalar kind at the top level rather than wrapping it", () => {
  // Wrapping would be a guess about intent, and a scalar and a one-element list
  // are different declarations. Only the author knows which was meant.
  assert.throws(
    () => admit({ name: "TaxRate", type: { kind: "number" }, value: 0.0825 }),
    code("invalid-type")
  );
});

test("stores formula and function source without interpreting it", () => {
  // A catalog, not an evaluator. Parsing here would make it one.
  assert.equal(
    admit({
      name: "Total",
      type: { kind: "scalar", field: { name: "value", type: { kind: "formula" } } },
      value: "subtotal * rate"
    }).value,
    "subtotal * rate"
  );

  assert.equal(
    admit({
      name: "Discount",
      type: { kind: "scalar", field: { name: "value", type: { kind: "function" } } },
      value: "this is not checked as a lambda yet"
    }).value,
    "this is not checked as a lambda yet"
  );
});

test("a reference is admitted as a name, and may point at nothing yet", () => {
  // Forward references are the normal case while a project is being written.
  assert.equal(
    admit({
      name: "OrdersCopy",
      type: { kind: "scalar", field: { name: "value", type: { kind: "reference" } } },
      value: "  FutureOrders  "
    }).value,
    "FutureOrders"
  );

  assert.throws(
    () =>
      admit({
        name: "Broken",
        type: { kind: "scalar", field: { name: "value", type: { kind: "reference" } } },
        value: "not an identifier"
      }),
    code("invalid-name")
  );
});

test("admits recursively nested table fields", () => {
  const input = {
    name: "Accounts",
    type: {
      kind: "table",
      fields: [
        { name: "id", type: { kind: "number" } },
        { name: "contacts", type: { kind: "list", field: { name: "email", type: { kind: "text" } } } },
        {
          name: "settings",
          type: { kind: "record", fields: [{ name: "enabled", type: { kind: "logic" } }] }
        }
      ]
    },
    value: [{ id: 1, contacts: ["ada@example.test"], settings: { enabled: true } }]
  };

  assert.deepEqual(admit(input).value, input.value);

  assert.throws(
    () => admit({ ...input, value: [{ id: 1, contacts: [42], settings: { enabled: true } }] }),
    code("invalid-value")
  );
});

test("a record must match its fields exactly, in both directions", () => {
  const type = { kind: "record", fields: [{ name: "name", type: { kind: "text" } }] };

  // Missing would store a record that does not match its own declaration.
  assert.throws(() => admit({ name: "Missing", type, value: {} }), code("invalid-schema"));
  // Unknown would either store data no reader can interpret, or drop what
  // someone wrote without saying so.
  assert.throws(
    () => admit({ name: "Extra", type, value: { name: "Ada", extra: true } }),
    code("invalid-schema")
  );
});

test("refuses a number that cannot survive the jsonb column", () => {
  const type = { kind: "scalar", field: { name: "v", type: { kind: "number" } } };

  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.throws(() => admit({ name: "N", type, value }), code("invalid-value"));
  }
});

test("refuses a value that refers to itself", () => {
  const row: Record<string, unknown> = { id: 1 };
  row.children = [row];

  assert.throws(
    () =>
      admit({
        name: "Cyclic",
        type: {
          kind: "table",
          fields: [
            { name: "id", type: { kind: "number" } },
            {
              name: "children",
              type: { kind: "list", field: { name: "child", type: { kind: "number" } } }
            }
          ]
        },
        value: [row]
      }),
    (error: unknown) => error instanceof NameManagerError
  );
});

test("refuses a declaration that is not an object at all", () => {
  for (const rejected of [undefined, null, "TaxRate", 7, []]) {
    assert.throws(() => admit(rejected), code("invalid-value"));
  }
});
