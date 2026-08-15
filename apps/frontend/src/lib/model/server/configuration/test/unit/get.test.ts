import assert from "node:assert/strict";
import { test } from "vitest";
import { get } from "$model/server/configuration/methods/get";

/**
 * Key resolution, tested against object literals rather than a directory of
 * fixtures — which is the reason the walk was separated from the file reading in
 * the first place.
 */

test("resolves a dot path", () => {
  const root = { logging: { destination: { kind: "piped" } } };
  assert.equal(get(root, "logging.destination.kind"), "piped");
});

test("a missing key, an empty segment, and a path through a scalar are all undefined", () => {
  const root = { logging: { level: "debug" } };

  assert.equal(get(root, "logging.absent"), undefined);
  assert.equal(get(root, "absent.entirely"), undefined);
  assert.equal(get(root, "logging..level"), undefined);
  assert.equal(get(root, ""), undefined);
  // `level` is a string, so it cannot be traversed through.
  assert.equal(get(root, "logging.level.deeper"), undefined);
});

test("does not resolve inherited properties", () => {
  // A key path must not reach `constructor` or `toString` just because every
  // object has one — configuration answers about what a file declared.
  assert.equal(get({}, "constructor"), undefined);
  assert.equal(get({}, "toString"), undefined);
});

test("a false or zero value is returned rather than treated as absent", () => {
  const root = { logging: { enabled: false }, retries: 0 };

  assert.equal(get(root, "logging.enabled"), false);
  assert.equal(get(root, "retries"), 0);
});
