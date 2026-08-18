import assert from "node:assert/strict";
import { test } from "vitest";
import { createConfiguration } from "$model/client/configuration";
import { requiredNumber } from "$model/client/configuration";

const snapshot = () => ({ revisions: { changeSets: { flushAfterOps: 50, flushAfterMs: 2000 } } });

test("reads a published key through the instance", () => {
  const configuration = createConfiguration(snapshot());

  assert.equal(configuration.get("revisions.changeSets.flushAfterOps"), 50);
});

test("every call returns a fresh object over its own snapshot", () => {
  // One client instance, one graph. Two configurations must not share a value.
  const a = createConfiguration({ revisions: { changeSets: { flushAfterOps: 10 } } });
  const b = createConfiguration({ revisions: { changeSets: { flushAfterOps: 20 } } });

  assert.notEqual(a, b);
  assert.equal(a.get("revisions.changeSets.flushAfterOps"), 10);
  assert.equal(b.get("revisions.changeSets.flushAfterOps"), 20);
});

test("an empty snapshot answers undefined rather than throwing", () => {
  // Absence is the consumer's problem to name, not this object's to guess at.
  assert.equal(createConfiguration({}).get("revisions.changeSets.flushAfterOps"), undefined);
});

test("the snapshot is not reachable through the surface", () => {
  // A getter handing the mapping back would make the published key list stop
  // being the contract, because a consumer could walk it.
  const configuration = createConfiguration(snapshot());

  assert.deepEqual(Object.keys(configuration), []);
  assert.deepEqual(
    Object.getOwnPropertyNames(Object.getPrototypeOf(configuration)).sort(),
    ["constructor", "get"]
  );
});

test("requiredNumber returns a published number", () => {
  const configuration = createConfiguration(snapshot());

  assert.equal(requiredNumber(configuration, "revisions.changeSets.flushAfterMs"), 2000);
});

test("requiredNumber throws for a key that was never published", () => {
  // A key missing from the allowlist is a deployment defect, and a silent
  // default would turn it into a client that batches differently from the one
  // that was configured, with nothing anywhere saying so.
  const configuration = createConfiguration({});

  assert.throws(
    () => requiredNumber(configuration, "revisions.changeSets.flushAfterOps"),
    /must be a finite number/
  );
});

test("requiredNumber throws for a value of the wrong shape", () => {
  const configuration = createConfiguration({ revisions: { changeSets: { flushAfterOps: "50" } } });

  assert.throws(
    () => requiredNumber(configuration, "revisions.changeSets.flushAfterOps"),
    /revisions\.changeSets\.flushAfterOps/
  );
});

test("requiredNumber refuses a non-finite number", () => {
  // NaN survives a typeof check and would silently disable a threshold.
  const configuration = createConfiguration({ revisions: { changeSets: { flushAfterOps: NaN } } });

  assert.throws(() => requiredNumber(configuration, "revisions.changeSets.flushAfterOps"));
});

test("requiredNumber names where to look", () => {
  assert.throws(() => requiredNumber(createConfiguration({}), "a.b"), /\+layout\.server\.ts/);
});
