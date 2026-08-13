import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DataManagerError,
  createDataManager,
  type NamedVariableInput
} from "#data-manager";

const errorCode = (code: DataManagerError["code"]) => (error: unknown): boolean =>
  error instanceof DataManagerError && error.code === code;

test("defines each table shape without wrapping scalar or list fields", () => {
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
  const record = manager.define({
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
  const table = manager.define({
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

  assert.equal(scalar.value, 0.0825);
  assert.deepEqual(list.value, ["north", "south"]);
  assert.deepEqual(record.value, { name: "Ada", active: true });
  assert.deepEqual(table.value, [
    { name: "Ada", active: true },
    { name: "Grace", active: false }
  ]);
});

test("stores formula, function, and forward-reference source without interpreting it", () => {
  const manager = createDataManager();

  const formula = manager.define({
    name: "Total",
    type: { kind: "scalar", field: { name: "value", type: { kind: "formula" } } },
    value: "subtotal * rate"
  });
  const fn = manager.define({
    name: "Discount",
    type: { kind: "scalar", field: { name: "value", type: { kind: "function" } } },
    value: "this is not checked as a lambda yet"
  });
  const reference = manager.define({
    name: "OrdersCopy",
    type: {
      kind: "scalar",
      field: { name: "value", type: { kind: "reference" } }
    },
    value: "  FutureOrders  "
  });

  assert.equal(formula.value, "subtotal * rate");
  assert.equal(fn.value, "this is not checked as a lambda yet");
  assert.equal(reference.value, "FutureOrders");
});

test("validates and canonicalizes Gregorian date values", () => {
  const manager = createDataManager();

  const date = manager.define({
    name: "ReleaseDate",
    type: { kind: "scalar", field: { name: "date", type: { kind: "date" } } },
    value: {
      calendar: "gregorian",
      dayName: "not trusted",
      day: 12,
      month: 8,
      year: 2026
    }
  });
  const dateTime = manager.define({
    name: "ReleaseMoment",
    type: { kind: "scalar", field: { name: "date", type: { kind: "date" } } },
    value: {
      calendar: "gregorian",
      day: 12,
      month: 8,
      year: 2026,
      timeZone: "America/Chicago",
      hour: 9,
      minute: 30,
      second: 4,
      millisecond: 125
    }
  });

  assert.deepEqual(date.value, {
    calendar: "gregorian",
    dayName: "Wednesday",
    day: 12,
    month: 8,
    year: 2026
  });
  assert.deepEqual(dateTime.value, {
    calendar: "gregorian",
    dayName: "Wednesday",
    day: 12,
    month: 8,
    year: 2026,
    timeZone: "America/Chicago",
    hour: 9,
    minute: 30,
    second: 4,
    millisecond: 125
  });

  assert.throws(
    () =>
      manager.define({
        name: "ImpossibleDate",
        type: { kind: "scalar", field: { name: "date", type: { kind: "date" } } },
        value: { calendar: "gregorian", day: 29, month: 2, year: 2025 }
      }),
    errorCode("invalid-value")
  );
  assert.throws(
    () =>
      manager.define({
        name: "PartialTime",
        type: { kind: "scalar", field: { name: "date", type: { kind: "date" } } },
        value: {
          calendar: "gregorian",
          day: 12,
          month: 8,
          year: 2026,
          hour: 9
        }
      }),
    errorCode("invalid-value")
  );
});

test("validates recursively nested table fields", () => {
  const manager = createDataManager();
  const input: NamedVariableInput = {
    name: "Accounts",
    type: {
      kind: "table",
      fields: [
        { name: "id", type: { kind: "number" } },
        {
          name: "contacts",
          type: {
            kind: "list",
            field: { name: "email", type: { kind: "text" } }
          }
        },
        {
          name: "settings",
          type: {
            kind: "record",
            fields: [{ name: "enabled", type: { kind: "logic" } }]
          }
        }
      ]
    },
    value: [
      {
        id: 1,
        contacts: ["ada@example.test", "admin@example.test"],
        settings: { enabled: true }
      }
    ]
  };

  assert.deepEqual(manager.define(input).value, input.value);
  assert.throws(
    () =>
      manager.define({
        ...input,
        name: "InvalidAccounts",
        value: [{ id: 1, contacts: [42], settings: { enabled: true } }]
      }),
    errorCode("invalid-value")
  );
});

test("rejects conflicting names and rows that do not exactly match their schema", () => {
  const manager = createDataManager();
  manager.define({
    name: "Customer",
    type: { kind: "record", fields: [{ name: "name", type: { kind: "text" } }] },
    value: { name: "Ada" }
  });

  assert.throws(
    () =>
      manager.define({
        name: "customer",
        type: { kind: "scalar", field: { name: "value", type: { kind: "number" } } },
        value: 1
      }),
    errorCode("name-conflict")
  );
  assert.throws(
    () =>
      manager.define({
        name: "MissingField",
        type: { kind: "record", fields: [{ name: "name", type: { kind: "text" } }] },
        value: {}
      }),
    errorCode("invalid-schema")
  );
  assert.throws(
    () =>
      manager.define({
        name: "ExtraField",
        type: { kind: "record", fields: [{ name: "name", type: { kind: "text" } }] },
        value: { name: "Ada", extra: true }
      }),
    errorCode("invalid-schema")
  );
});

test("does not share mutable declaration state with callers", () => {
  const manager = createDataManager();
  const input: NamedVariableInput = {
    name: "Rows",
    type: { kind: "table", fields: [{ name: "value", type: { kind: "number" } }] },
    value: [{ value: 1 }]
  };
  const defined = manager.define(input);

  (input.value as Array<{ value: number }>)[0]!.value = 99;
  (defined.value as Array<{ value: number }>)[0]!.value = 88;
  const firstRead = manager.require("Rows");
  (firstRead.value as Array<{ value: number }>)[0]!.value = 77;

  assert.deepEqual(manager.require("Rows").value, [{ value: 1 }]);
});
