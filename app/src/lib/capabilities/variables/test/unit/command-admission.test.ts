import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { validateReadVariables } from "$capabilities/variables/api/read-variables/validate-read-variables";
import { validateRemoveVariable } from "$capabilities/variables/api/remove-variable/validate-remove-variable";
import { validateSaveVariable } from "$capabilities/variables/api/save-variable/validate-save-variable";

const save = () => ({
  name: "rate",
  value: { kind: "number", value: 4 },
  type: "number"
});

const withHidden = <T extends object>(value: T): T => {
  Object.defineProperty(value, "hidden", { value: true, enumerable: false });
  return value;
};

const withSymbol = <T extends object>(value: T): T => {
  Object.defineProperty(value, Symbol("hidden"), { value: true, enumerable: true });
  return value;
};

describe("variable command admission", () => {
  it("requires the current exact empty read command", () => {
    assert.deepEqual(validateReadVariables({}), {});
    assert.deepEqual(validateReadVariables(Object.create(null)), {});
    for (const refused of [
      undefined,
      null,
      [],
      { retired: true },
      { retired: undefined },
      withHidden({}),
      withSymbol({}),
      Object.create({})
    ]) assert.throws(() => validateReadVariables(refused));
  });

  it("requires the current exact save envelope", () => {
    assert.deepEqual(validateSaveVariable(save()), save());
    assert.deepEqual(validateSaveVariable({ ...save(), description: "Discount rate" }), {
      ...save(),
      description: "Discount rate"
    });
    for (const refused of [
      { ...save(), extra: true },
      { ...save(), description: undefined },
      withHidden(save()),
      withSymbol(save()),
      Object.assign(Object.create({}), save()),
      { ...save(), type: "numeric" }
    ]) assert.throws(() => validateSaveVariable(refused));
  });

  it("does not execute an accessor while refusing it", () => {
    let reads = 0;
    const input = { name: "rate", type: "number" };
    Object.defineProperty(input, "value", {
      enumerable: true,
      get: () => {
        reads += 1;
        return { kind: "number", value: 4 };
      }
    });
    assert.throws(() => validateSaveVariable(input));
    assert.equal(reads, 0);
  });

  it("admits exact nested current values and nominal represented IDs", () => {
    for (const value of [
      {
        kind: "record",
        fields: { rate: { kind: "number", value: 4 } }
      },
      {
        kind: "range",
        resourceId: "spreadsheets:forecast",
        from: { rowId: "#one", columnId: "revenue" },
        to: { rowId: "#two", columnId: "revenue" }
      },
      {
        kind: "function",
        parameters: ["rate"],
        formulaId: "formulas:discount"
      },
      {
        kind: "reference",
        target: { to: "resource", ref: { kind: "document", id: "documents:source" } }
      }
    ]) assert.doesNotThrow(() => validateSaveVariable({
      name: "value",
      value,
      type: "any"
    }));
  });

  it("rejects legacy, mixed, lossy, and wrongly namespaced nested values", () => {
    const hiddenValues = withHidden([{ kind: "text", value: "one" }]);
    const symbolicFields = withSymbol({ rate: { kind: "number", value: 4 } });
    for (const value of [
      { kind: "number", value: 4, retired: true },
      { kind: "number", value: undefined },
      { kind: "number", value: 4, text: "legacy" },
      withHidden({ kind: "number", value: 4 }),
      withSymbol({ kind: "number", value: 4 }),
      Object.assign(Object.create({}), { kind: "number", value: 4 }),
      { kind: "list", values: hiddenValues },
      { kind: "record", fields: symbolicFields },
      {
        kind: "range",
        resourceId: "documents:forecast",
        from: { rowId: "#one", columnId: "revenue" },
        to: { rowId: "#two", columnId: "revenue" }
      },
      { kind: "function", parameters: ["rate"], formulaId: "variables:discount" },
      {
        kind: "reference",
        target: { to: "resource", ref: { kind: "document", id: "presentations:source" } }
      }
    ]) assert.throws(() => validateSaveVariable({ name: "value", value, type: "any" }));
  });

  it("requires one exact plain remove name", () => {
    assert.deepEqual(validateRemoveVariable({ name: "rate" }), { name: "rate" });
    for (const refused of [
      {},
      { name: "rate", extra: true },
      { name: undefined },
      withHidden({ name: "rate" }),
      withSymbol({ name: "rate" }),
      Object.assign(Object.create({}), { name: "rate" })
    ]) assert.throws(() => validateRemoveVariable(refused));
  });
});
