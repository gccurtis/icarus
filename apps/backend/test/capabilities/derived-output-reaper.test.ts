import assert from "node:assert/strict";
import test from "node:test";
import {
  createDerivedOutputReaper,
  type DerivedOutputClaimant
} from "../../src/1-init/create/derivedOutputReaper.js";
import { CapturingLogger } from "../helpers/testDoubles.js";

const CUTOFF = "2026-08-01T00:00:00.000Z";

class FakeClaimant implements DerivedOutputClaimant {
  released: string[] = [];
  listCalls: string[] = [];
  listFailure?: Error;
  releaseFailureFor?: string;

  constructor(
    readonly kind: string,
    private detached: Array<{ outputId: string; detachedAt: string }>
  ) {}

  async listDetachedOutputs(
    cutoff: string
  ): Promise<Array<{ outputId: string; detachedAt: string }>> {
    this.listCalls.push(cutoff);
    if (this.listFailure) throw this.listFailure;
    return this.detached;
  }

  async releaseDetachedOutput(outputId: string): Promise<void> {
    if (this.releaseFailureFor === outputId) {
      throw new Error(`release failed for ${outputId}`);
    }
    this.released.push(outputId);
    this.detached = this.detached.filter((entry) => entry.outputId !== outputId);
  }
}

class FakeDerivedOutputs {
  deleted: string[] = [];
  missing = new Set<string>();
  failFor?: string;

  async delete(outputId: string): Promise<void> {
    if (this.failFor === outputId) throw new Error("delete exploded");
    if (this.missing.has(outputId)) {
      const error = new Error("gone");
      error.name = "DerivedOutputNotFoundError";
      throw error;
    }
    this.deleted.push(outputId);
  }
}

test("the reaper deletes released outputs and forgets their ownership rows", async () => {
  const claimant = new FakeClaimant("document", [
    { outputId: "out-1", detachedAt: "2026-07-01T00:00:00.000Z" },
    { outputId: "out-2", detachedAt: "2026-07-02T00:00:00.000Z" }
  ]);
  const derivedOutputs = new FakeDerivedOutputs();
  const reaper = createDerivedOutputReaper({
    claimants: [claimant],
    derivedOutputs,
    logger: new CapturingLogger()
  });

  assert.equal(await reaper.purgeExpired(CUTOFF), 2);
  assert.deepEqual(derivedOutputs.deleted, ["out-1", "out-2"]);
  assert.deepEqual(claimant.released, ["out-1", "out-2"]);
  // The cutoff is passed through, because the grace period is what tells an
  // abandoned output from one undo can still re-attach.
  assert.deepEqual(claimant.listCalls, [CUTOFF]);

  // It owns no history of its own; Derived Outputs prunes what the deletions
  // leave behind.
  assert.equal(await reaper.pruneHistory(CUTOFF), 0);
});

test("the reaper only touches what an owner released", async () => {
  // The defining constraint. A diff of "every output minus everything claimed"
  // would delete every output declared through the Derived Outputs API, which
  // legitimately has no owner at all. The reaper never enumerates outputs.
  const claimant = new FakeClaimant("document", []);
  const derivedOutputs = new FakeDerivedOutputs();
  const reaper = createDerivedOutputReaper({
    claimants: [claimant],
    derivedOutputs,
    logger: new CapturingLogger()
  });

  assert.equal(await reaper.purgeExpired(CUTOFF), 0);
  assert.deepEqual(derivedOutputs.deleted, []);
});

test("every claimant is swept, and each names its own reaped outputs", async () => {
  // Slides owns a byte-identical ownership table and becomes a second claimant
  // the day it is wired in. A sweep hard-wired to Document would have started
  // deleting its outputs silently.
  const document = new FakeClaimant("document", [
    { outputId: "doc-out", detachedAt: "2026-07-01T00:00:00.000Z" }
  ]);
  const slides = new FakeClaimant("slides", [
    { outputId: "slide-out", detachedAt: "2026-07-01T00:00:00.000Z" }
  ]);
  const derivedOutputs = new FakeDerivedOutputs();
  const logger = new CapturingLogger();
  const reaper = createDerivedOutputReaper({
    claimants: [document, slides],
    derivedOutputs,
    logger
  });

  assert.equal(await reaper.purgeExpired(CUTOFF), 2);
  assert.deepEqual(derivedOutputs.deleted.sort(), ["doc-out", "slide-out"]);

  const reaped = logger.entries
    .filter((entry) => entry.message === "derived-outputs.reap.deleted")
    .map((entry) => (entry.data as Record<string, unknown>));
  assert.deepEqual(
    reaped.map((data) => [data.claimant, data.outputId]),
    [["document", "doc-out"], ["slides", "slide-out"]]
  );
});

test("a failed delete keeps the ownership row so the next sweep retries", async () => {
  const claimant = new FakeClaimant("document", [
    { outputId: "out-bad", detachedAt: "2026-07-01T00:00:00.000Z" },
    { outputId: "out-good", detachedAt: "2026-07-01T00:00:00.000Z" }
  ]);
  const derivedOutputs = new FakeDerivedOutputs();
  derivedOutputs.failFor = "out-bad";
  const logger = new CapturingLogger();
  const reaper = createDerivedOutputReaper({
    claimants: [claimant],
    derivedOutputs,
    logger
  });

  // The failure is isolated: the rest of the batch still goes.
  assert.equal(await reaper.purgeExpired(CUTOFF), 1);
  assert.deepEqual(derivedOutputs.deleted, ["out-good"]);
  // The row for the failure survives — it is the only record that this output
  // still needs reaping, so dropping it would lose the leak instead of closing
  // it.
  assert.deepEqual(claimant.released, ["out-good"]);
  assert.ok(logger.entries.some((entry) =>
    entry.message === "derived-outputs.reap.delete-failed"));
});

test("an output already gone still has its ownership row released", async () => {
  // The expected outcome on a retry after a partial run: the delete succeeded
  // last time and the release did not.
  const claimant = new FakeClaimant("document", [
    { outputId: "out-gone", detachedAt: "2026-07-01T00:00:00.000Z" }
  ]);
  const derivedOutputs = new FakeDerivedOutputs();
  derivedOutputs.missing.add("out-gone");
  const reaper = createDerivedOutputReaper({
    claimants: [claimant],
    derivedOutputs,
    logger: new CapturingLogger()
  });

  assert.equal(await reaper.purgeExpired(CUTOFF), 1);
  assert.deepEqual(derivedOutputs.deleted, []);
  assert.deepEqual(claimant.released, ["out-gone"]);
});

test("one claimant failing to list does not stop the others", async () => {
  const broken = new FakeClaimant("document", []);
  broken.listFailure = new Error("store unavailable");
  const working = new FakeClaimant("slides", [
    { outputId: "slide-out", detachedAt: "2026-07-01T00:00:00.000Z" }
  ]);
  const derivedOutputs = new FakeDerivedOutputs();
  const logger = new CapturingLogger();
  const reaper = createDerivedOutputReaper({
    claimants: [broken, working],
    derivedOutputs,
    logger
  });

  assert.equal(await reaper.purgeExpired(CUTOFF), 1);
  assert.deepEqual(derivedOutputs.deleted, ["slide-out"]);
  assert.ok(logger.entries.some((entry) =>
    entry.message === "derived-outputs.reap.list-failed"));
});
