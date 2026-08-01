import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  ActivityTransactionConflictError,
  createActivityCapability,
  SQLiteActivityStore,
  type ActivityClock,
  type ActivityTransaction
} from "../../src/3-capabilities/activity/index.js";

const PROJECT_ID = "activity-test-project";

const transaction = (
  id: string,
  overrides: Partial<ActivityTransaction> = {}
): ActivityTransaction => ({
  id,
  kind: "document",
  resourceId: "document-1",
  operation: "changed",
  revision: 1,
  actorId: "user-1",
  origin: "user",
  occurredAt: "2026-08-01T00:00:00.000Z",
  metadata: { operationTypes: ["document.rename"] },
  ...overrides
});

const createFixture = (initialTime = "2026-08-01T00:00:00.000Z") => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-activity-"));
  const store = new SQLiteActivityStore(PROJECT_ID, join(directory, "activity.db"));
  let currentTime = initialTime;
  const clock: ActivityClock = { now: () => currentTime };
  const activity = createActivityCapability(store, { presenceTtlMs: 1_000 }, clock);
  return {
    activity,
    store,
    setTime: (value: string) => {
      currentTime = value;
    }
  };
};

test("Activity publishes one stable transaction exactly once", async (t) => {
  const { activity, store } = createFixture();
  t.after(() => store.close());

  const first = await activity.publish(transaction("transaction-1", {
    metadata: { alpha: 1, beta: ["x"] }
  }));
  const replay = await activity.publish(transaction("transaction-1", {
    metadata: { beta: ["x"], alpha: 1 }
  }));

  assert.equal(first.id, "transaction-1");
  assert.equal(first.sequence, 1);
  assert.deepEqual(replay, first);

  await assert.rejects(
    () => activity.publish(transaction("transaction-1", { operation: "renamed" })),
    (error) => error instanceof ActivityTransactionConflictError
  );
});

test("Activity orders and filters published transactions", async (t) => {
  const { activity, store } = createFixture();
  t.after(() => store.close());

  await activity.publish(transaction("transaction-1", { resourceId: "document-1" }));
  await activity.publish(transaction("transaction-2", { resourceId: "document-2", revision: 2 }));
  await activity.publish(transaction("transaction-3", {
    kind: "project",
    resourceId: undefined,
    operation: "configured",
    revision: undefined
  }));

  const all = await activity.query({
    type: "activity.transactions",
    filter: { limit: 2 }
  });
  assert.equal(all.type, "activity.transactions");
  if (all.type !== "activity.transactions") assert.fail("unexpected query result");
  assert.deepEqual(all.page.items.map((item) => item.id), ["transaction-3", "transaction-2"]);
  assert.ok(all.page.nextCursor);

  const next = await activity.query({
    type: "activity.transactions",
    filter: { cursor: all.page.nextCursor }
  });
  assert.equal(next.type, "activity.transactions");
  if (next.type !== "activity.transactions") assert.fail("unexpected query result");
  assert.deepEqual(next.page.items.map((item) => item.id), ["transaction-1"]);

  const filtered = await activity.query({
    type: "activity.transactions",
    filter: { kind: "document", resourceId: "document-2" }
  });
  assert.equal(filtered.type, "activity.transactions");
  if (filtered.type !== "activity.transactions") assert.fail("unexpected query result");
  assert.deepEqual(filtered.page.items.map((item) => item.id), ["transaction-2"]);
});

test("Presence leases expire without becoming Activity transactions", async (t) => {
  const { activity, store, setTime } = createFixture();
  t.after(() => store.close());

  const lease = await activity.presence.heartbeat({
    sessionId: "session-1",
    actorId: "user-1",
    kind: "document",
    resourceId: "document-1",
    state: { display: { name: "Ada" } }
  });
  assert.equal(lease.expiresAt, "2026-08-01T00:00:01.000Z");

  const current = await activity.query({
    type: "presence.list",
    filter: { kind: "document", resourceId: "document-1" }
  });
  assert.equal(current.type, "presence.list");
  if (current.type !== "presence.list") assert.fail("unexpected query result");
  assert.equal(current.leases.length, 1);

  setTime("2026-08-01T00:00:01.000Z");
  const expired = await activity.query({ type: "presence.list" });
  assert.equal(expired.type, "presence.list");
  if (expired.type !== "presence.list") assert.fail("unexpected query result");
  assert.deepEqual(expired.leases, []);
  assert.equal(await activity.presence.removeExpired(), 1);

  const transactions = await activity.query({ type: "activity.transactions" });
  assert.equal(transactions.type, "activity.transactions");
  if (transactions.type !== "activity.transactions") assert.fail("unexpected query result");
  assert.deepEqual(transactions.page.items, []);
});
