import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  ActivityTransactionConflictError,
  createActivityCapability,
  SQLiteActivityStore,
  type ActivityClock,
  type ActivityTransactionInput
} from "../../src/capabilities/activity/index.js";
import { CapturingLogger } from "../helpers/testDoubles.js";

const PROJECT_ID = "activity-test-project";

const transaction = (
  idempotencyKey: string,
  overrides: Partial<ActivityTransactionInput> = {}
): ActivityTransactionInput => ({
  idempotencyKey,
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
  const logger = new CapturingLogger();
  const activity = createActivityCapability(
    store,
    { logger },
    { presenceTtlMs: 1_000 },
    clock
  );
  return {
    activity,
    logger,
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

  assert.notEqual(first.id, "transaction-1");
  assert.equal(
    first.id,
    `act_${createHash("sha256").update("transaction-1").digest("hex")}`
  );
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

  const first = await activity.publish(transaction("transaction-1", { resourceId: "document-1" }));
  const second = await activity.publish(transaction("transaction-2", { resourceId: "document-2", revision: 2 }));
  const third = await activity.publish(transaction("transaction-3", {
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
  assert.deepEqual(all.page.items.map((item) => item.id), [third.id, second.id]);
  assert.ok(all.page.nextCursor);

  const next = await activity.query({
    type: "activity.transactions",
    filter: { cursor: all.page.nextCursor }
  });
  assert.equal(next.type, "activity.transactions");
  if (next.type !== "activity.transactions") assert.fail("unexpected query result");
  assert.deepEqual(next.page.items.map((item) => item.id), [first.id]);

  const filtered = await activity.query({
    type: "activity.transactions",
    filter: { kind: "document", resourceId: "document-2" }
  });
  assert.equal(filtered.type, "activity.transactions");
  if (filtered.type !== "activity.transactions") assert.fail("unexpected query result");
  assert.deepEqual(filtered.page.items.map((item) => item.id), [second.id]);
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

test("Activity allocates IDs and logs operations without metadata or Presence state", async (t) => {
  const { activity, logger, store } = createFixture();
  t.after(() => store.close());

  const input = transaction("source-key", {
    metadata: { privateValue: "secret-activity-metadata" }
  });
  const accepted = await activity.publish(input);
  const replayed = await activity.publish(input);
  assert.equal(replayed.id, accepted.id);
  assert.notEqual(accepted.id, input.idempotencyKey);

  await activity.query({ type: "activity.transaction", transactionId: accepted.id });
  await activity.presence.heartbeat({
    sessionId: "session-logging",
    actorId: "user-logging",
    state: { cursorSecret: "secret-presence-state" }
  });
  await activity.presence.list();
  await activity.presence.leave("session-logging");

  const acceptedLogs = logger.entries.filter(
    (entry) => entry.message === "activity.transaction.accepted"
  );
  assert.equal(acceptedLogs.length, 2);
  assert.deepEqual(
    acceptedLogs.map((entry) => (entry.data as { replayed: boolean }).replayed),
    [false, true]
  );
  const messages = logger.entries.map((entry) => entry.message);
  assert.ok(messages.includes("activity.runtime.created"));
  assert.ok(messages.includes("activity.transaction.read"));
  assert.ok(messages.includes("activity.presence.heartbeat"));
  assert.ok(messages.includes("activity.presence.listed"));
  assert.ok(messages.includes("activity.presence.left"));

  const serialized = JSON.stringify(logger.entries);
  assert.doesNotMatch(serialized, /secret-activity-metadata/);
  assert.doesNotMatch(serialized, /secret-presence-state/);

  await assert.rejects(
    () => activity.publish({ ...input, id: "caller-selected" } as ActivityTransactionInput),
    (error) => error instanceof Error && error.name === "ActivityValidationError"
  );
});
