import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { define } from "$name-manager/api/define/define";
import { get } from "$name-manager/api/get/get";
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

test("finds a declaration under any casing of its authored name", async () => {
  const defined = await define(scope, scalar);

  assert.deepEqual(await get(scope, "taxrate"), defined);
  assert.deepEqual(await get(scope, "TAXRATE"), defined);
  assert.deepEqual(await get(scope, "  TaxRate  "), defined);
});

test("an absent name is an ordinary answer", async () => {
  assert.equal(await get(scope, "NeverDefined"), undefined);
});

test("an unusable name is not, and still fails", async () => {
  // Answering "not found" would tell a caller the name is available when it is
  // not, and they would find out at `define`.
  await assert.rejects(
    () => get(scope, "not a valid identifier"),
    (error: unknown) => error instanceof NameManagerError && error.code === "invalid-name"
  );
});

test("a reference value is not itself a definition", async () => {
  // Defining something that points at `FutureOrders` must not make
  // `FutureOrders` resolvable.
  await define(scope, {
    name: "OrdersCopy",
    type: { kind: "scalar", field: { name: "value", type: { kind: "reference" } } },
    value: "FutureOrders"
  });

  assert.equal(await get(scope, "FutureOrders"), undefined);
});

test("admits exactly what define admits", async () => {
  // The invariant that earns `canonicalName` and `findVariable` their place in
  // shared/: if the writer and the reader disagreed, `define` would admit a
  // name `get` could never find.
  await define(scope, { ...scalar, name: "  Spaced  " } as NamedVariableInput);

  assert.equal((await get(scope, "Spaced"))?.name, "Spaced");
  assert.equal((await get(scope, "  spaced  "))?.name, "Spaced");
});

test("each caller gets its own copy", async () => {
  await define(scope, {
    name: "Rows",
    type: { kind: "table", fields: [{ name: "value", type: { kind: "number" } }] },
    value: [{ value: 1 }]
  });

  const first = (await get(scope, "Rows"))?.value as Array<{ value: number }>;
  first[0]!.value = 99;

  assert.deepEqual((await get(scope, "Rows"))?.value, [{ value: 1 }]);
});
