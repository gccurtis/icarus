import assert from "node:assert/strict";
import { test } from "vitest";
import { canonicalName, nameKey } from "$name-manager/api/shared/canonical-name";
import { NameManagerError } from "$name-manager/errors";

/**
 * Tier one: no database, no mock. `canonicalName` is a pure function over its
 * input, and the backend could only reach it through a fake store.
 */
const invalidName = (error: unknown): boolean =>
  error instanceof NameManagerError && error.code === "invalid-name";

test("trims, and keeps the authored casing", () => {
  assert.equal(canonicalName("  TaxRate  ", "variable.name"), "TaxRate");
});

test("admits an ASCII identifier, including a leading underscore", () => {
  assert.equal(canonicalName("_private1", "variable.name"), "_private1");
});

test("refuses anything that would need quoting to be referenced", () => {
  // The reason the pattern is narrow: these names are written into formulas, so
  // a name needing escapes is a name that will be got wrong.
  for (const rejected of ["1st", "tax rate", "tax-rate", "tax.rate", "τ", ""]) {
    assert.throws(() => canonicalName(rejected, "variable.name"), invalidName, rejected);
  }
});

test("refuses a value that is not a string", () => {
  for (const rejected of [undefined, null, 7, {}, []]) {
    assert.throws(() => canonicalName(rejected, "variable.name"), invalidName);
  }
});

test("names the path it was admitting, so a nested failure says which field", () => {
  assert.throws(
    () => canonicalName(" ", "variable.type.fields[2].name"),
    (error: unknown) =>
      error instanceof NameManagerError &&
      error.message.startsWith("variable.type.fields[2].name")
  );
});

test("the lookup key folds case and nothing else", () => {
  assert.equal(nameKey("TaxRate"), "taxrate");
  assert.equal(nameKey("_A1"), "_a1");
});
