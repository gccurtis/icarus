import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import {
  getResourceHistory,
  initializeResourceHistorySchema,
  insertHistoryDeletion,
  insertHistorySnapshot,
  listExpiredDeletedResources,
  pruneHistoryBefore
} from "../../src/0-utils/persistence/resourceHistory.js";
import {
  ResourceRetentionScheduler,
  bindResourceRetentionPort
} from "../../src/0-utils/persistence/resourceRetentionScheduler.js";
import { CapturingLogger } from "../helpers/testDoubles.js";

const fixedClock = {
  now: (): Date => new Date("2026-08-02T12:00:00.000Z")
};

const daysBeforeFixedClock = (days: number): string =>
  new Date(fixedClock.now().getTime() - days * 24 * 60 * 60 * 1_000).toISOString();

test("the retention boundary keeps 29- and 30-day records and expires 31-day records", () => {
  const db = new Database(":memory:");
  initializeResourceHistorySchema(db, "resource_history");
  for (const age of [29, 30, 31]) {
    insertHistorySnapshot(db, "resource_history", {
      resourceKind: "live",
      resourceId: `live-${age}`,
      revision: 1,
      snapshot: { age },
      recordedAt: daysBeforeFixedClock(age)
    });
    insertHistoryDeletion(db, "resource_history", {
      resourceKind: "deleted",
      resourceId: `deleted-${age}`,
      revision: 1,
      recordedAt: daysBeforeFixedClock(age)
    });
  }

  const cutoff = daysBeforeFixedClock(30);
  assert.deepEqual(
    listExpiredDeletedResources(db, "resource_history", cutoff),
    [{ resourceKind: "deleted", resourceId: "deleted-31" }]
  );
  assert.equal(pruneHistoryBefore(db, "resource_history", cutoff), 1);
  assert.equal(getResourceHistory(db, "resource_history", "live", "live-29").length, 1);
  assert.equal(getResourceHistory(db, "resource_history", "live", "live-30").length, 1);
  assert.equal(getResourceHistory(db, "resource_history", "live", "live-31").length, 0);
  db.close();
});

test("retention sweep uses the configured cutoff and isolates capability failures", async () => {
  const logger = new CapturingLogger();
  const calls: string[] = [];
  const scheduler = new ResourceRetentionScheduler(
    { revisionRetentionDays: 30, sweepIntervalHours: 24 },
    [
      bindResourceRetentionPort("failing", {
        purgeExpired: (cutoff) => {
          calls.push(`failing.purge:${cutoff}`);
          throw new Error("purge failed");
        },
        pruneHistory: (cutoff) => {
          calls.push(`failing.prune:${cutoff}`);
          return 2;
        }
      }),
      bindResourceRetentionPort("healthy", {
        purgeExpired: async (cutoff) => {
          calls.push(`healthy.purge:${cutoff}`);
          return 3;
        },
        pruneHistory: async (cutoff) => {
          calls.push(`healthy.prune:${cutoff}`);
          return 5;
        }
      })
    ],
    logger,
    fixedClock
  );

  const result = await scheduler.runNow();
  const cutoff = "2026-07-03T12:00:00.000Z";
  assert.deepEqual(result, { cutoff, purged: 3, pruned: 7, failures: 1 });
  assert.deepEqual(calls, [
    `failing.purge:${cutoff}`,
    `failing.prune:${cutoff}`,
    `healthy.purge:${cutoff}`,
    `healthy.prune:${cutoff}`
  ]);
  assert.equal(
    logger.entries.some(
      (entry) => entry.level === "error" && entry.message === "retention.capability.failed"
    ),
    true
  );
});

test("retention scheduler runs immediately, coalesces active sweeps, and stops cleanly", async () => {
  const logger = new CapturingLogger();
  let releasePurge!: () => void;
  const purgeBarrier = new Promise<void>((resolve) => {
    releasePurge = resolve;
  });
  let purgeCalls = 0;
  let pruneCalls = 0;
  const scheduler = new ResourceRetentionScheduler(
    { revisionRetentionDays: 30, sweepIntervalHours: 24 },
    [
      bindResourceRetentionPort("slow", {
        purgeExpired: async () => {
          purgeCalls += 1;
          await purgeBarrier;
          return 0;
        },
        pruneHistory: () => {
          pruneCalls += 1;
          return 0;
        }
      })
    ],
    logger,
    fixedClock
  );

  const startup = scheduler.start();
  const sameSweep = scheduler.runNow();
  assert.equal(purgeCalls, 1);
  releasePurge();
  await Promise.all([startup, sameSweep]);
  assert.equal(pruneCalls, 1);

  await scheduler.stop();
  assert.equal(
    logger.entries.some((entry) => entry.message === "retention.scheduler.stopped"),
    true
  );
});
