import assert from "node:assert/strict";
import { test } from "node:test";
import {
  NameManagerError,
  createNameManager
} from "#name-manager";
import { silentLogger } from "#name-manager/test/fixture.js";

const errorCode = (code: NameManagerError["code"]) => (error: unknown): boolean =>
  error instanceof NameManagerError && error.code === code;

test("returns the declaration a name identifies", () => {
  const manager = createNameManager(silentLogger);
  const defined = manager.define({
    name: "Customer",
    type: { kind: "record", fields: [{ name: "name", type: { kind: "text" } }] },
    value: { name: "Ada" }
  });

  assert.deepEqual(manager.require("customer"), defined);
});

test("raises variable-not-found rather than returning undefined", () => {
  const manager = createNameManager(silentLogger);

  assert.throws(() => manager.require("Unknown"), errorCode("variable-not-found"));
});
