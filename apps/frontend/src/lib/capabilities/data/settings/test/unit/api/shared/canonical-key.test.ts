import assert from "node:assert/strict";
import { test } from "vitest";
import { canonicalKey } from "$settings/api/shared/canonical-key";
import { SettingsError } from "$settings/errors";

/**
 * A pure procedure, tested purely.
 *
 * No database, no mock, no fixture — which is the point of a capability being
 * procedural. Under the old runtime-object shape the only way to reach this
 * check was through a method call on an object holding a store, so testing it
 * meant faking one.
 */

const rejects = (value: unknown, why: string): void => {
  assert.throws(
    () => canonicalKey(value),
    (error: unknown) =>
      error instanceof SettingsError && error.code === "invalid-key",
    why
  );
};

test("admits dotted lowercase paths", () => {
  assert.equal(canonicalKey("theme"), "theme");
  assert.equal(canonicalKey("editor.font-size"), "editor.font-size");
  assert.equal(canonicalKey("a1.b2-c3"), "a1.b2-c3");
});

test("trims surrounding whitespace but preserves case distinctions", () => {
  // Whitespace is a transcription artifact nobody means.
  assert.equal(canonicalKey("  theme  "), "theme");

  // Case is not: `Theme` is a key someone chose, and folding it would silently
  // merge two settings into one. So it is refused rather than rewritten.
  rejects("Theme", "uppercase is a different key, not a variant of this one");
});

test("refuses anything that is not a usable identifier", () => {
  rejects(undefined, "absent");
  rejects(42, "not a string");
  rejects("", "empty");
  rejects("   ", "whitespace only");
  rejects(".theme", "leading separator");
  rejects("theme.", "trailing separator");
  rejects("theme..color", "doubled separator");
  rejects("theme color", "space inside");
  rejects("théme", "non-ASCII");
  rejects("a".repeat(129), "over the length bound");
});

test("admits a key exactly at the length bound", () => {
  // The boundary itself, because an off-by-one here rejects a key that was
  // written down somewhere as valid.
  assert.equal(canonicalKey("a".repeat(128)).length, 128);
});
