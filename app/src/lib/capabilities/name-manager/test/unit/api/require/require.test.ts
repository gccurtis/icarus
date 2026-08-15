import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { define } from "$name-manager/api/define/define";
import { get } from "$name-manager/api/get/get";
import { require } from "$name-manager/api/require/require";
import { NameManagerError } from "$name-manager/errors";
import { installDatabases, scopeFor } from "$name-manager/test/fixture";
import type { NamedVariableInput } from "$name-manager/types/variables";

vi.mock(
  "$model/server/index.server",
  async () => (await import("$name-manager/test/stub")).serverStub()
);

installDatabases();

const scope = scopeFor("project-a");

const scalar = {
  name: "TaxRate",
  type: { kind: "scalar", field: { name: "rate", type: { kind: "number" } } },
  value: 0.0825
} as const satisfies NamedVariableInput;

test("returns the declaration a name identifies", async () => {
  const defined = await define(scope, scalar);

  assert.deepEqual(await require(scope, "taxrate"), defined);
});

test("absence is a stated failure rather than undefined", async () => {
  // The whole difference from `get`, and the reason both exist: a caller that
  // cannot continue is told why with a code, instead of every such caller
  // inventing its own message for the same condition.
  await assert.rejects(
    () => require(scope, "NeverDefined"),
    (error: unknown) => error instanceof NameManagerError && error.code === "variable-not-found"
  );
});

test("agrees with get on everything except absence", async () => {
  await define(scope, scalar);

  assert.deepEqual(await require(scope, "TaxRate"), await get(scope, "TaxRate"));
});

test("an unusable name fails as a name, not as an absence", async () => {
  await assert.rejects(
    () => require(scope, "not a valid identifier"),
    (error: unknown) => error instanceof NameManagerError && error.code === "invalid-name"
  );
});
