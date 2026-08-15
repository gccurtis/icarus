import assert from "node:assert/strict";
import { test } from "vitest";
import { freeze, merge } from "$model/server/configuration/constructor";

/**
 * The pure half of construction: how sections combine, and what stops a consumer
 * from writing through what it read.
 */

/**
 * Merged mappings have a null prototype, so comparing one against an object
 * literal fails on the prototype alone. Rebuilt through JSON here; the property
 * itself is asserted directly below.
 */
const plain = (value: unknown): unknown => JSON.parse(JSON.stringify(value)) as unknown;

test("overlay wins, and nested mappings merge rather than replace", () => {
  const result = merge(
    { logging: { enabled: true, level: "info" }, kept: 1 },
    { logging: { level: "debug" } }
  );

  assert.deepEqual(plain(result), { logging: { enabled: true, level: "debug" }, kept: 1 });
});

test("an array replaces rather than concatenating", () => {
  // Someone editing a list means the list, not an append to a default they
  // cannot see.
  const result = merge({ hosts: ["a", "b"] }, { hosts: ["c"] });
  assert.deepEqual(plain(result), { hosts: ["c"] });
});

test("merged mappings have no prototype, so a YAML key cannot pollute one", () => {
  // A configuration file is edited by people and read by everything. A `__proto__`
  // or `constructor` key landing on Object.prototype would change objects the
  // configuration has nothing to do with.
  const result = merge({}, { nested: { value: 1 } });

  assert.equal(Object.getPrototypeOf(result), null);
  assert.equal(Object.getPrototypeOf(result.nested), null);
});

test("a merged value is a copy, so mutating the source cannot reach the result", () => {
  const base = { nested: { value: 1 } };
  const result = merge(base, {});

  base.nested.value = 2;

  assert.equal((result.nested as { value: number }).value, 1);
});

test("freezing reaches nested mappings and arrays", () => {
  const root = { nested: { value: 1 }, list: [{ value: 2 }] };
  freeze(root);

  assert.throws(() => {
    (root.nested as { value: number }).value = 99;
  }, TypeError);
  assert.throws(() => root.list.push({ value: 3 }), TypeError);
});
