import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { define } from "$name-manager/api/define/define";
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

const code = (expected: string) => (error: unknown): boolean =>
  error instanceof NameManagerError && error.code === expected;

const scalar = {
  name: "TaxRate",
  type: { kind: "scalar", field: { name: "rate", type: { kind: "number" } } },
  value: 0.0825
} as const satisfies NamedVariableInput;

test("stores a declaration and returns it as stored", async () => {
  const defined = await define(scope, scalar);

  assert.equal(defined.name, "TaxRate");
  assert.equal(defined.value, 0.0825);
  assert.deepEqual((await require(scope, "TaxRate")).value, 0.0825);
});

test("a name is taken in every casing", async () => {
  await define(scope, scalar);

  await assert.rejects(
    () =>
      define(scope, {
        name: "taxrate",
        type: { kind: "scalar", field: { name: "v", type: { kind: "number" } } },
        value: 1
      }),
    code("name-conflict")
  );
});

test("the conflict is decided before the type and value are admitted", async () => {
  // Behavior, not an implementation detail. Someone re-running a definition
  // they already made is told the true reason, rather than being sent to fix a
  // type that was never the problem.
  await define(scope, scalar);

  await assert.rejects(
    () =>
      define(scope, {
        name: "TaxRate",
        // Both of these would fail admission on their own.
        type: { kind: "matrix" },
        value: undefined
      } as unknown as NamedVariableInput),
    code("name-conflict")
  );
});

test("an unusable name fails as a name, not as a conflict", async () => {
  await assert.rejects(
    () =>
      define(scope, {
        name: "not a valid identifier",
        type: { kind: "scalar", field: { name: "v", type: { kind: "number" } } },
        value: 1
      }),
    code("invalid-name")
  );
});

test("the authored casing survives, and the lookup folds it", async () => {
  await define(scope, scalar);

  assert.equal((await require(scope, "taxrate")).name, "TaxRate");
  assert.equal((await require(scope, "TAXRATE")).name, "TaxRate");
});

test("nothing is stored when admission refuses", async () => {
  await assert.rejects(
    () =>
      define(scope, {
        name: "Broken",
        type: { kind: "record", fields: [{ name: "name", type: { kind: "text" } }] },
        value: {}
      } as unknown as NamedVariableInput),
    code("invalid-schema")
  );

  await assert.rejects(() => require(scope, "Broken"), code("variable-not-found"));
});

test("does not share mutable state with the caller, in either direction", async () => {
  // The reason `define` copies what it returns even though it just built it:
  // the value shares structure with the input the caller still holds.
  const input: NamedVariableInput = {
    name: "Rows",
    type: { kind: "table", fields: [{ name: "value", type: { kind: "number" } }] },
    value: [{ value: 1 }]
  };

  const defined = await define(scope, input);

  (input.value as Array<{ value: number }>)[0]!.value = 99;
  (defined.value as Array<{ value: number }>)[0]!.value = 88;
  const firstRead = await require(scope, "Rows");
  (firstRead.value as Array<{ value: number }>)[0]!.value = 77;

  assert.deepEqual((await require(scope, "Rows")).value, [{ value: 1 }]);
});

test("two definitions of the same name resolve to exactly one winner", async () => {
  // Both pass the existence check; the insert's conflict clause is what decides.
  const attempts = [
    define(scope, scalar),
    define(scope, { ...scalar, value: 0.1 }),
    define(scope, { ...scalar, value: 0.2 })
  ];

  const settled = await Promise.allSettled(attempts);
  const fulfilled = settled.filter((outcome) => outcome.status === "fulfilled");
  const conflicts = settled.filter(
    (outcome) => outcome.status === "rejected" && code("name-conflict")(outcome.reason)
  );

  assert.equal(fulfilled.length, 1);
  assert.equal(conflicts.length, 2);
});
