import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createApp } from "../../src/1-init/create/app.js";
import { JobRegistry } from "../../src/0-utils/jobs/registry.js";
import { JobScheduler } from "../../src/0-utils/jobs/scheduler.js";
import { registerHttpTransport } from "../../src/2-transport/registerHttpTransport.js";
import type {
  CommentCommand,
  CommentQuery,
  CommentsCapability
} from "../../src/3-capabilities/comments/index.js";
import { registerCommentEndpoints } from "../../src/4-job-wiring/comments/registerCommentEndpoints.js";
import { CapturingLogger } from "../helpers/testDoubles.js";

const backendPackage = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8")
) as { imports?: Record<string, unknown> };

const schedulerConfig = {
  concurrentWorkers: 1,
  serialQueueMaxSize: 4,
  concurrentQueueMaxSize: 4
};

test("Comments aliases are available to the built runtime", () => {
  const imports = backendPackage.imports ?? {};
  for (const alias of ["#comments", "#comments/*"]) {
    assert.ok(alias in imports, `missing package import alias: ${alias}`);
  }
});

const createCommentsDouble = (): {
  comments: CommentsCapability;
  commands: CommentCommand[];
  queries: CommentQuery[];
} => {
  const commands: CommentCommand[] = [];
  const queries: CommentQuery[] = [];
  const comments: CommentsCapability = {
    command: async (command) => {
      commands.push(command);
      if (command.type !== "comment.create") throw new Error("unexpected command");
      return {
        type: "comment.created",
        comment: {
          id: "comment-1",
          body: command.body,
          mentions: [],
          target: command.target,
          state: "open",
          createdBy: "trusted-user",
          updatedBy: "trusted-user",
          createdAt: "2026-08-02T00:00:00.000Z",
          updatedAt: "2026-08-02T00:00:00.000Z"
        }
      };
    },
    query: async (query) => {
      queries.push(query);
      if (query.type !== "comment.listByTarget") throw new Error("unexpected query");
      return { type: "comment.listByTarget", page: { items: [] } };
    },
    publishPendingActivity: async () => 0
  };
  return { comments, commands, queries };
};

const createHarness = () => {
  const logger = new CapturingLogger();
  const registry = new JobRegistry();
  const double = createCommentsDouble();
  registerCommentEndpoints(registry, double.comments, logger);
  const app = createApp();
  registerHttpTransport(app, {
    scheduler: new JobScheduler(schedulerConfig, logger),
    registry,
    logger
  });
  return { app, ...double };
};

test("Comments endpoints decode commands and target queries", async (t) => {
  const { app, commands, queries } = createHarness();
  t.after(() => app.close());

  const commandResponse = await app.inject({
    method: "POST",
    url: "/comments/command",
    payload: {
      type: "comment.create",
      requestId: "request-1",
      body: "A comment",
      target: {
        resourceKind: "document",
        resourceId: "document-1",
        subTarget: { range: { start: 1, end: 4 } }
      }
    }
  });
  assert.equal(commandResponse.statusCode, 201);
  assert.equal(commands.length, 1);

  const queryResponse = await app.inject({
    method: "POST",
    url: "/comments/query",
    payload: {
      type: "comment.listByTarget",
      target: { resourceKind: "document", resourceId: "document-1" },
      state: "open",
      limit: 20
    }
  });
  assert.equal(queryResponse.statusCode, 200);
  assert.deepEqual(queries, [{
    type: "comment.listByTarget",
    target: { resourceKind: "document", resourceId: "document-1" },
    state: "open",
    limit: 20
  }]);
});

test("Comments public commands reject caller-controlled attribution and scalar sub-targets", async (t) => {
  const { app, commands } = createHarness();
  t.after(() => app.close());

  const attribution = await app.inject({
    method: "POST",
    url: "/comments/command",
    payload: {
      type: "comment.create",
      requestId: "request-1",
      body: "A comment",
      target: { resourceKind: "document", resourceId: "document-1" },
      actorId: "caller-controlled"
    }
  });
  assert.equal(attribution.statusCode, 400);

  const scalarSubTarget = await app.inject({
    method: "POST",
    url: "/comments/command",
    payload: {
      type: "comment.create",
      requestId: "request-2",
      body: "A comment",
      target: {
        resourceKind: "document",
        resourceId: "document-1",
        subTarget: "not-an-object"
      }
    }
  });
  assert.equal(scalarSubTarget.statusCode, 400);
  assert.equal(commands.length, 0);
});
