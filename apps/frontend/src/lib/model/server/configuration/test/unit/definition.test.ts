import assert from "node:assert/strict";
import { test } from "vitest";
import { SnapshotConfiguration } from "$model/server/configuration/definition";

test("the snapshot reads through to the tree it was built from", () => {
  const configuration = new SnapshotConfiguration({ project: { id: "default" } });

  assert.equal(configuration.get("project.id"), "default");
  assert.equal(configuration.get("project.missing"), undefined);
});

test("two snapshots hold their own trees", () => {
  // The definition holds state, so the proof that it holds no shared state is
  // two instances disagreeing about the same key.
  const first = new SnapshotConfiguration({ project: { id: "alpha" } });
  const second = new SnapshotConfiguration({ project: { id: "beta" } });

  assert.equal(first.get("project.id"), "alpha");
  assert.equal(second.get("project.id"), "beta");
});
