import assert from "node:assert/strict";
import { test } from "node:test";
import {
  NameManagerError
} from "#name-manager";
import { testNameManager } from "#name-manager/test/fixture.js";

const errorCode = (code: NameManagerError["code"]) => (error: unknown): boolean =>
  error instanceof NameManagerError && error.code === code;

test("returns the declaration a name identifies", async () => {
  const manager = testNameManager();
  const defined = await manager.define({
    name: "Customer",
    type: { kind: "record", fields: [{ name: "name", type: { kind: "text" } }] },
    value: { name: "Ada" }
  });

  assert.deepEqual(await manager.require("customer"), defined);
});

test("raises variable-not-found rather than returning undefined", async () => {
  const manager = testNameManager();

  await assert.rejects(
    () => manager.require("Unknown"),
    errorCode("variable-not-found")
  );
});
