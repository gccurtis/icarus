import assert from "node:assert/strict";
import { test } from "vitest";
import { canonicalValue } from "$settings/api/set/canonical-value";
import { SettingsError } from "$settings/errors";

const rejects = (value: unknown, why: string): void => {
  assert.throws(
    () => canonicalValue(value),
    (error: unknown) =>
      error instanceof SettingsError && error.code === "invalid-value",
    why
  );
};

test("admits every JSON shape", () => {
  assert.equal(canonicalValue("dark"), "dark");
  assert.equal(canonicalValue(14), 14);
  assert.equal(canonicalValue(true), true);
  assert.equal(canonicalValue(null), null);
  assert.deepEqual(canonicalValue([1, "two", false]), [1, "two", false]);
  assert.deepEqual(canonicalValue({ font: { size: 14 } }), { font: { size: 14 } });
});

test("severs every reference to the caller's object", () => {
  // The reason admission returns a value rather than a boolean. Without this,
  // what was stored could be changed afterwards from outside the capability.
  const original = { font: { size: 14 } };
  const admitted = canonicalValue(original) as { font: { size: number } };

  original.font.size = 99;

  assert.equal(admitted.font.size, 14);
});

test("refuses what cannot survive a round trip through JSON", () => {
  rejects(undefined, "absent — and absence is not a deletion");
  rejects(() => 1, "a function serializes to nothing");
  rejects(Symbol("x"), "a symbol serializes to nothing");
  rejects(1n, "BigInt has no JSON form");

  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  rejects(cyclic, "a cycle would throw inside the driver instead");
});

test("refuses a value larger than the bound", () => {
  // Without a bound, one request decides how much of a project's database a
  // caller occupies.
  rejects({ blob: "x".repeat(65 * 1024) }, "over 64 KB serialized");
  assert.ok(canonicalValue({ blob: "x".repeat(1024) }));
});

test("refuses prototype-pollution keys at any depth", () => {
  // JSON.parse creates these as ordinary own properties, so nothing is polluted
  // here. The risk is downstream: this value is stored, read back, and merged by
  // code that has no idea a browser wrote it.
  rejects(JSON.parse('{"__proto__": {"admin": true}}'), "at the top level");
  rejects(JSON.parse('{"a": {"__proto__": {"admin": true}}}'), "nested");
  rejects(JSON.parse('{"a": [{"constructor": 1}]}'), "inside an array");
  rejects(JSON.parse('{"prototype": 1}'), "prototype");
});

test("a plain key that merely looks suspicious is fine", () => {
  // The check is for the three names that reach an object's prototype, not for
  // anything containing the word.
  assert.deepEqual(canonicalValue({ prototypeName: "x" }), { prototypeName: "x" });
});
