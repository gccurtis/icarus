import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { toCommentActivityTransaction } from "../../src/1-init/create/comments.js";
import {
  CommentIdempotencyMismatchError,
  CommentNotFoundError,
  InvalidCommentCursorError,
  SQLiteCommentStore,
  createCommentsCapability,
  type CommentActivityTransaction,
  type CommentClock
} from "../../src/3-capabilities/comments/index.js";
import { CapturingLogger } from "../helpers/testDoubles.js";

const createFixture = (projectId = "comments-test-project") => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-comments-"));
  const store = new SQLiteCommentStore(projectId, join(directory, "comments.db"));
  const published: CommentActivityTransaction[] = [];
  const logger = new CapturingLogger();
  let sequence = 0;
  let timestamp = "2026-08-02T00:00:00.000Z";
  const clock: CommentClock = { now: () => timestamp };
  const comments = createCommentsCapability(
    store,
    {
      logger,
      attribution: { actorId: "user-1", origin: "user" },
      activityPublisher: {
        publish: async (transaction) => {
          published.push(transaction);
        }
      }
    },
    {},
    clock,
    () => `generated-${++sequence}`
  );
  return {
    comments,
    logger,
    published,
    store,
    setTimestamp: (value: string) => {
      timestamp = value;
    }
  };
};

test("Comments owns opaque object sub-targets, mentions, lifecycle, and replay", async (t) => {
  const { comments, published, store, setTimestamp } = createFixture();
  t.after(() => store.close());

  const createCommand = {
    type: "comment.create" as const,
    requestId: "request-create",
    body: "  Hello @Ada and @BOB; ada@example.com and @ada.  ",
    target: {
      resourceKind: "document",
      resourceId: "document-1",
      subTarget: {
        range: { end: 8, start: 2 },
        path: ["rows", 0, "blocks", 1],
        resourceOwned: true
      }
    }
  };
  const created = await comments.command(createCommand);
  assert.equal(created.type, "comment.created");
  if (created.type !== "comment.created") assert.fail("unexpected command result");
  assert.equal(created.comment.body, "Hello @Ada and @BOB; ada@example.com and @ada.");
  assert.deepEqual(created.comment.mentions, ["ada", "bob"]);
  assert.deepEqual(created.comment.target.subTarget, {
    path: ["rows", 0, "blocks", 1],
    range: { end: 8, start: 2 },
    resourceOwned: true
  });
  assert.equal(created.comment.createdBy, "user-1");
  assert.equal(published.length, 1);

  assert.deepEqual(await comments.command(createCommand), created);
  assert.equal(published.length, 1, "replay must not publish another Activity transaction");
  await assert.rejects(
    () => comments.command({ ...createCommand, body: "different" }),
    (error) => error instanceof CommentIdempotencyMismatchError
  );

  setTimestamp("2026-08-02T00:01:00.000Z");
  const resolved = await comments.command({
    type: "comment.resolve",
    requestId: "request-resolve",
    commentId: created.comment.id
  });
  assert.equal(resolved.type, "comment.resolved");
  assert.equal(published.length, 2);

  const resolvedAgain = await comments.command({
    type: "comment.resolve",
    requestId: "request-resolve-noop",
    commentId: created.comment.id
  });
  assert.equal(resolvedAgain.type, "comment.resolved");
  assert.equal(published.length, 2, "an already-resolved command is a recorded no-op");

  setTimestamp("2026-08-02T00:02:00.000Z");
  await comments.command({
    type: "comment.update",
    requestId: "request-update",
    commentId: created.comment.id,
    body: "Updated for @Carol"
  });
  const listed = await comments.query({
    type: "comment.listByTarget",
    target: { resourceKind: "document", resourceId: "document-1" },
    state: "resolved"
  });
  assert.equal(listed.type, "comment.listByTarget");
  if (listed.type !== "comment.listByTarget") assert.fail("unexpected query result");
  assert.equal(listed.page.items.length, 1);
  assert.deepEqual(listed.page.items[0].mentions, ["carol"]);

  setTimestamp("2026-08-02T00:03:00.000Z");
  const deleteCommand = {
    type: "comment.delete" as const,
    requestId: "request-delete",
    commentId: created.comment.id
  };
  const deleted = await comments.command(deleteCommand);
  assert.deepEqual(await comments.command(deleteCommand), deleted);
  await assert.rejects(
    () => comments.query({ type: "comment.get", commentId: created.comment.id }),
    (error) => error instanceof CommentNotFoundError
  );
  await assert.rejects(
    () => comments.command({
      type: "comment.reopen",
      requestId: "request-after-delete",
      commentId: created.comment.id
    }),
    (error) => error instanceof CommentNotFoundError
  );
});

test("Comments keeps failed Activity delivery durable and retries the stable transaction", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-comments-outbox-"));
  const store = new SQLiteCommentStore("outbox-project", join(directory, "comments.db"));
  t.after(() => store.close());
  const attempts: string[] = [];
  let fail = true;
  let nextId = 0;
  const comments = createCommentsCapability(
    store,
    {
      logger: new CapturingLogger(),
      attribution: { actorId: "agent-1", origin: "agent" },
      activityPublisher: {
        publish: async (transaction) => {
          attempts.push(transaction.transactionId);
          if (fail) throw new Error("Activity unavailable");
        }
      }
    },
    {},
    { now: () => "2026-08-02T00:00:00.000Z" },
    () => `outbox-${++nextId}`
  );

  const accepted = await comments.command({
    type: "comment.create",
    requestId: "request-1",
    body: "Accepted independently",
    target: { resourceKind: "slides", resourceId: "slide-1" }
  });
  assert.equal(accepted.type, "comment.created");
  assert.deepEqual(attempts, ["outbox-2"]);

  fail = false;
  assert.equal(await comments.publishPendingActivity(), 1);
  assert.deepEqual(attempts, ["outbox-2", "outbox-2"]);
  assert.equal(await comments.publishPendingActivity(), 0);
});

test("Comments paginates by target and binds cursors to the original filter", async (t) => {
  const { comments, store, setTimestamp } = createFixture("pagination-project");
  t.after(() => store.close());

  for (let index = 0; index < 3; index += 1) {
    setTimestamp(`2026-08-02T00:00:0${index}.000Z`);
    await comments.command({
      type: "comment.create",
      requestId: `request-${index}`,
      body: `Comment ${index}`,
      target: { resourceKind: "document", resourceId: "document-1" }
    });
  }

  const first = await comments.query({
    type: "comment.listByTarget",
    target: { resourceKind: "document", resourceId: "document-1" },
    limit: 2
  });
  assert.equal(first.type, "comment.listByTarget");
  if (first.type !== "comment.listByTarget") assert.fail("unexpected query result");
  assert.equal(first.page.items.length, 2);
  assert.ok(first.page.nextCursor);

  const second = await comments.query({
    type: "comment.listByTarget",
    target: { resourceKind: "document", resourceId: "document-1" },
    cursor: first.page.nextCursor,
    limit: 2
  });
  assert.equal(second.type, "comment.listByTarget");
  if (second.type !== "comment.listByTarget") assert.fail("unexpected query result");
  assert.equal(second.page.items.length, 1);

  await assert.rejects(
    () => comments.query({
      type: "comment.listByTarget",
      target: { resourceKind: "document", resourceId: "document-2" },
      cursor: first.page.nextCursor
    }),
    (error) => error instanceof InvalidCommentCursorError
  );
});

test("Comments isolates project tables even when stores share one database", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-comments-projects-"));
  const dbPath = join(directory, "comments.db");
  const firstStore = new SQLiteCommentStore("project-one", dbPath);
  const secondStore = new SQLiteCommentStore("project-two", dbPath);
  t.after(() => {
    firstStore.close();
    secondStore.close();
  });
  let nextId = 0;
  const runtime = (store: SQLiteCommentStore, actorId: string) => createCommentsCapability(
    store,
    { logger: new CapturingLogger(), attribution: { actorId, origin: "user" } },
    {},
    { now: () => "2026-08-02T00:00:00.000Z" },
    () => `shared-id-${++nextId}`
  );
  const first = runtime(firstStore, "user-one");
  const second = runtime(secondStore, "user-two");

  const created = await first.command({
    type: "comment.create",
    requestId: "same-request",
    body: "Only in project one",
    target: { resourceKind: "document", resourceId: "document-1" }
  });
  assert.equal(created.type, "comment.created");

  const otherProject = await second.query({
    type: "comment.listByTarget",
    target: { resourceKind: "document", resourceId: "document-1" }
  });
  assert.equal(otherProject.type, "comment.listByTarget");
  if (otherProject.type !== "comment.listByTarget") assert.fail("unexpected query result");
  assert.deepEqual(otherProject.page.items, []);

  const secondCreated = await second.command({
    type: "comment.create",
    requestId: "same-request",
    body: "Allowed in project two",
    target: { resourceKind: "document", resourceId: "document-1" }
  });
  assert.equal(secondCreated.type, "comment.created");
});

test("Comments logs operational outcomes without authored content or sub-target values", async (t) => {
  const { comments, logger, store } = createFixture("logging-project");
  t.after(() => store.close());

  const created = await comments.command({
    type: "comment.create",
    requestId: "logging-request",
    body: "authored-secret-body @Ada",
    target: {
      resourceKind: "document",
      resourceId: "document-logging",
      subTarget: { privateAnchor: "secret-sub-target-value" }
    }
  });
  assert.equal(created.type, "comment.created");
  if (created.type !== "comment.created") assert.fail("unexpected command result");
  await comments.query({ type: "comment.get", commentId: created.comment.id });
  await comments.command({
    type: "comment.resolve",
    requestId: "logging-resolve",
    commentId: created.comment.id
  });

  const messages = logger.entries.map((entry) => entry.message);
  assert.ok(messages.includes("comments.runtime.created"));
  assert.ok(messages.includes("comments.mutation.committed"));
  assert.ok(messages.includes("comments.activity.published"));
  assert.ok(messages.includes("comments.command.completed"));
  assert.ok(messages.includes("comments.read"));

  const serialized = JSON.stringify(logger.entries);
  assert.doesNotMatch(serialized, /authored-secret-body/);
  assert.doesNotMatch(serialized, /secret-sub-target-value/);
  assert.doesNotMatch(serialized, /@Ada/);
});

test("Comment Activity mapping omits body, handles, and opaque sub-target content", () => {
  const mapped = toCommentActivityTransaction({
    transactionId: "transaction-1",
    sourceRequestId: "request-1",
    operation: "created",
    commentId: "comment-1",
    resourceKind: "document",
    resourceId: "document-1",
    state: "open",
    mentionCount: 2,
    actorId: "user-1",
    origin: "user",
    occurredAt: "2026-08-02T00:00:00.000Z"
  });
  assert.deepEqual(mapped, {
    idempotencyKey: "transaction-1",
    kind: "comment",
    resourceId: "comment-1",
    operation: "created",
    actorId: "user-1",
    origin: "user",
    occurredAt: "2026-08-02T00:00:00.000Z",
    metadata: {
      target: { resourceKind: "document", resourceId: "document-1" },
      state: "open",
      mentionCount: 2
    }
  });
});
