import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DataManagerError,
  createDataManager
} from "#data-manager";

const errorCode = (code: DataManagerError["code"]) => (error: unknown): boolean =>
  error instanceof DataManagerError && error.code === code;

test("returns the declaration a name identifies", () => {
  const manager = createDataManager();
  const defined = manager.define({
    name: "Customer",
    type: { kind: "record", fields: [{ name: "name", type: { kind: "text" } }] },
    value: { name: "Ada" }
  });

  assert.deepEqual(manager.require("customer"), defined);
});

test("raises variable-not-found rather than returning undefined", () => {
  const manager = createDataManager();

  assert.throws(() => manager.require("Unknown"), errorCode("variable-not-found"));
});
