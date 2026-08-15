import assert from "node:assert/strict";
import { test } from "vitest";
import { canonicalType } from "$name-manager/api/define/canonical-type";
import { NameManagerError } from "$name-manager/errors";

/** Tier one: pure, and previously reachable only through a fake store. */
const code = (expected: string) => (error: unknown): boolean =>
  error instanceof NameManagerError && error.code === expected;

const admit = (input: unknown) => canonicalType(input, "variable.type", new Set());

test("admits each scalar kind as itself", () => {
  for (const kind of ["number", "text", "logic", "date", "formula", "function", "reference"]) {
    assert.deepEqual(admit({ kind }), { kind });
  }
});

test("drops anything alongside a scalar kind", () => {
  // A scalar type is its kind. Carrying an extra field through would let a
  // caller believe a property they set means something.
  assert.deepEqual(admit({ kind: "number", precision: 4 }), { kind: "number" });
});

test("admits the four table shapes and their nested fields", () => {
  assert.deepEqual(admit({ kind: "scalar", field: { name: "rate", type: { kind: "number" } } }), {
    kind: "scalar",
    field: { name: "rate", type: { kind: "number" } }
  });

  assert.deepEqual(
    admit({
      kind: "table",
      fields: [
        { name: "id", type: { kind: "number" } },
        { name: "tags", type: { kind: "list", field: { name: "tag", type: { kind: "text" } } } }
      ]
    }),
    {
      kind: "table",
      fields: [
        { name: "id", type: { kind: "number" } },
        { name: "tags", type: { kind: "list", field: { name: "tag", type: { kind: "text" } } } }
      ]
    }
  );
});

test("refuses an unknown kind", () => {
  assert.throws(() => admit({ kind: "matrix" }), code("invalid-type"));
  assert.throws(() => admit({}), code("invalid-type"));
  assert.throws(() => admit("number"), code("invalid-type"));
});

test("refuses two fields whose names differ only in casing", () => {
  // Compared by lookup key, so they collide here rather than becoming two
  // columns nobody can tell apart.
  assert.throws(
    () =>
      admit({
        kind: "record",
        fields: [
          { name: "Total", type: { kind: "number" } },
          { name: "total", type: { kind: "number" } }
        ]
      }),
    code("invalid-schema")
  );
});

test("refuses a type that contains itself", () => {
  // The reason `ancestors` is threaded down each branch: without it this
  // recurses until the stack runs out instead of stating what is wrong.
  const cyclic: Record<string, unknown> = { kind: "record" };
  cyclic.fields = [{ name: "self", type: cyclic }];

  assert.throws(() => admit(cyclic), code("invalid-schema"));
});

test("a type reused in two sibling branches is not a cycle", () => {
  // Ancestors are per-branch, not global. The same object appearing twice side
  // by side is ordinary reuse and must stay admissible.
  const shared = { kind: "text" };

  assert.deepEqual(
    admit({
      kind: "record",
      fields: [
        { name: "left", type: shared },
        { name: "right", type: shared }
      ]
    }),
    {
      kind: "record",
      fields: [
        { name: "left", type: { kind: "text" } },
        { name: "right", type: { kind: "text" } }
      ]
    }
  );
});

test("refuses a field list that is not an array, or a field that is not an object", () => {
  assert.throws(() => admit({ kind: "record", fields: {} }), code("invalid-schema"));
  assert.throws(() => admit({ kind: "record", fields: ["name"] }), code("invalid-schema"));
});

test("refuses a field whose name is not an identifier", () => {
  assert.throws(
    () => admit({ kind: "record", fields: [{ name: "not valid", type: { kind: "text" } }] }),
    code("invalid-name")
  );
});
