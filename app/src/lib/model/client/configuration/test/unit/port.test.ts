import assert from "node:assert/strict";
import { test } from "vitest";

import { bindConfiguration } from "$model/client/configuration/port";
import { createConfigurationState } from "$model/client/configuration/state";
import type { ClientConfigurationInput } from "$model/client/configuration/types";

const input = (flushAfterOps = 50): ClientConfigurationInput => ({
  revisions: {
    changeSets: { flushAfterOps, flushAfterMs: 2_000 },
    sync: { everyMs: 4_000 }
  },
  workspace: { changeSets: { flushAfterOps: 20, flushAfterMs: 800 } },
  presentation: {
    stage: { unitsHigh: 720, widthRem: 52, averageGlyphWidthEm: 0.52 },
    zoom: { minimum: 50, maximum: 200, step: 5 },
    gutter: { minimumRem: 0.75, maximumRem: 2.5 }
  }
});

const adapterFor = (flushAfterOps = 50) =>
  bindConfiguration(createConfigurationState(input(flushAfterOps)));

test("the adapter declares one read-only client-workspace lifetime", () => {
  const adapter = adapterFor();

  assert.equal(adapter.lifetime, "client-workspace");
  assert.equal(adapter.commitMode, "read-only");
  assert.deepEqual(Object.keys(adapter), ["lifetime", "commitMode", "acquire", "release", "close"]);
});

test("every acquisition is a fresh frozen exact facade", () => {
  const adapter = adapterFor();
  const first = adapter.acquire(undefined);
  const second = adapter.acquire(undefined);

  assert.notEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.getPrototypeOf(first), Object.prototype);
  assert.deepEqual(Object.keys(first), ["getNumber", "commit"]);
  assert.equal(first.getNumber("revisions.changeSets.flushAfterOps"), 50);
  assert.doesNotThrow(() => first.commit());
});

test("release invalidates the facade and an extracted operation", () => {
  const adapter = adapterFor();
  const port = adapter.acquire(undefined);
  const read = port.getNumber;

  adapter.release(port);

  assert.throws(() => port.commit(), /released/);
  assert.throws(() => read("revisions.changeSets.flushAfterOps"), /released/);
});

test("releasing one lease does not invalidate another", () => {
  const adapter = adapterFor();
  const first = adapter.acquire(undefined);
  const second = adapter.acquire(undefined);

  adapter.release(first);

  assert.throws(() => first.getNumber("revisions.changeSets.flushAfterOps"), /released/);
  assert.equal(second.getNumber("revisions.changeSets.flushAfterOps"), 50);
});

test("release is defensively idempotent", () => {
  const adapter = adapterFor();
  const port = adapter.acquire(undefined);

  adapter.release(port);

  assert.doesNotThrow(() => adapter.release(port));
});

test("an adapter rejects a foreign or forged facade", () => {
  const first = adapterFor(10);
  const second = adapterFor(20);
  const foreign = first.acquire(undefined);
  const forged = Object.freeze({ getNumber: foreign.getNumber, commit: foreign.commit });

  assert.throws(() => second.release(foreign), /not acquired from this adapter/);
  assert.throws(() => first.release(forged), /not acquired from this adapter/);
  assert.equal(foreign.getNumber("revisions.changeSets.flushAfterOps"), 10);
});

test("close ends the workspace lifetime and invalidates every open lease", () => {
  const adapter = adapterFor();
  const first = adapter.acquire(undefined);
  const second = adapter.acquire(undefined);

  adapter.close();

  assert.throws(() => first.getNumber("revisions.changeSets.flushAfterOps"), /released/);
  assert.throws(() => second.commit(), /released/);
  assert.throws(() => adapter.acquire(undefined), /closed/);
  assert.doesNotThrow(() => adapter.release(first));
  assert.doesNotThrow(() => adapter.close());
});
