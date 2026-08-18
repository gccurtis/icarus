import assert from "node:assert/strict";
import { test } from "vitest";
import { get } from "$model/client/configuration/methods/get";

/**
 * Key resolution, which is the whole of what this object does.
 *
 * These assertions are deliberately the same ones the server's `get` carries,
 * because the two traversals must not drift — a key resolving differently on the
 * two sides would make it mean two things.
 */
const snapshot = {
  revisions: { changeSets: { flushAfterOps: 50, flushAfterMs: 2000 } },
  list: [1, 2, 3],
  zero: 0,
  blank: ""
};

test("resolves a dotted path to a leaf", () => {
  assert.equal(get(snapshot, "revisions.changeSets.flushAfterOps"), 50);
  assert.equal(get(snapshot, "revisions.changeSets.flushAfterMs"), 2000);
});

test("resolves a path to a mapping", () => {
  assert.deepEqual(get(snapshot, "revisions.changeSets"), {
    flushAfterOps: 50,
    flushAfterMs: 2000
  });
});

test("returns falsy values rather than treating them as missing", () => {
  // The distinction a default would destroy: a configured 0 is a decision.
  assert.equal(get(snapshot, "zero"), 0);
  assert.equal(get(snapshot, "blank"), "");
});

test("a missing key is undefined", () => {
  assert.equal(get(snapshot, "revisions.changeSets.flushAfterHours"), undefined);
  assert.equal(get(snapshot, "absent"), undefined);
});

test("a path through a non-mapping is undefined, not a crash", () => {
  assert.equal(get(snapshot, "revisions.changeSets.flushAfterOps.nope"), undefined);
});

test("an array is a value, never a container to descend into", () => {
  // Otherwise `list.0` would mean something different depending on how the YAML
  // was written.
  assert.deepEqual(get(snapshot, "list"), [1, 2, 3]);
  assert.equal(get(snapshot, "list.0"), undefined);
});

test("an empty key, or one with an empty segment, is undefined", () => {
  assert.equal(get(snapshot, ""), undefined);
  assert.equal(get(snapshot, "revisions..changeSets"), undefined);
  assert.equal(get(snapshot, ".revisions"), undefined);
});

test("inherited properties are not reachable", () => {
  // Configuration answers about what was published, not about what every
  // JavaScript object inherits.
  assert.equal(get(snapshot, "constructor"), undefined);
  assert.equal(get(snapshot, "toString"), undefined);
  assert.equal(get(snapshot, "revisions.hasOwnProperty"), undefined);
});
