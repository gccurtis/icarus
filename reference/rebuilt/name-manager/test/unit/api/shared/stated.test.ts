import assert from "node:assert/strict";
import { test } from "vitest";
import { stated } from "$name-manager/api/shared/stated";
import { NameManagerError } from "$name-manager/errors";

/**
 * Tier one: no database. `stated` decides what a browser is allowed to learn,
 * and that decision is worth asserting on its own.
 */
const status = (error: unknown): number | undefined =>
  (error as { status?: number } | undefined)?.status;

test("passes a value through untouched", async () => {
  assert.equal(await stated(async () => 42), 42);
});

test("a stated refusal becomes a 400 carrying its code", async () => {
  // Without this the browser sees `500 Internal Error`, and a view cannot tell
  // "that input was refused" from "the server is broken".
  await assert.rejects(
    () =>
      stated(async () => {
        throw new NameManagerError("name-conflict", "Variable name 'TaxRate' is already defined");
      }),
    (error: unknown) =>
      status(error) === 400 &&
      (error as { body: { message: string } }).body.message ===
        "name-conflict: Variable name 'TaxRate' is already defined"
  );
});

test("a fault stays opaque", async () => {
  // Not ours to describe. A null dereference is not a message for a browser.
  const failure = new Error("connection refused at 10.0.0.4:5432");

  await assert.rejects(
    () =>
      stated(async () => {
        throw failure;
      }),
    (error: unknown) => error === failure
  );
});
