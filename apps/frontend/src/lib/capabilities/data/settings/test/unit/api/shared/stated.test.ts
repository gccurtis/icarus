import assert from "node:assert/strict";
import { test } from "vitest";
import { stated } from "$settings/api/shared/stated";
import { SettingsError } from "$settings/errors";

/**
 * Why this exists at all: a `SettingsError` thrown inside a remote function
 * reaches the browser as `500 Internal Error`, because kit hides thrown values
 * and cannot tell one of ours from a null dereference. Found by calling the real
 * endpoint, not by reading the code.
 */

const statusOf = (error: unknown): number | undefined =>
  typeof error === "object" && error !== null && "status" in error
    ? (error as { status: number }).status
    : undefined;

const bodyOf = (error: unknown): string | undefined =>
  typeof error === "object" && error !== null && "body" in error
    ? (error as { body: { message: string } }).body.message
    : undefined;

test("passes a result through untouched", async () => {
  assert.equal(await stated(async () => "value"), "value");
});

test("turns a stated refusal into a 400 carrying its code", async () => {
  const caught = await stated(async () => {
    throw new SettingsError("invalid-key", "not an identifier");
  }).catch((error: unknown) => error);

  assert.equal(statusOf(caught), 400);
  assert.equal(bodyOf(caught), "invalid-key: not an identifier");
});

test("lets a fault stay a fault", async () => {
  // Anything without a code is not ours to describe, and describing it would
  // leak whatever the message happens to contain.
  const thrown = new TypeError("undefined is not a function");
  const caught = await stated(async () => {
    throw thrown;
  }).catch((error: unknown) => error);

  assert.equal(caught, thrown);
  assert.equal(statusOf(caught), undefined);
});
