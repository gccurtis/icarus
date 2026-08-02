import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createApp } from "../../src/1-init/create/app.js";
import { JobRegistry } from "../../src/0-utils/jobs/registry.js";
import { JobScheduler } from "../../src/0-utils/jobs/scheduler.js";
import { registerHttpTransport } from "../../src/2-transport/registerHttpTransport.js";
import { registerActivityEndpoints } from "../../src/4-job-wiring/activity/registerActivityEndpoints.js";
import type {
  ActivityCapability,
  ActivityQuery,
  ActivityTransactionInput
} from "../../src/3-capabilities/activity/index.js";
import { CapturingLogger } from "../helpers/testDoubles.js";

const backendPackage = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8")
) as { imports?: Record<string, unknown> };

const schedulerConfig = {
  concurrentWorkers: 1,
  serialQueueMaxSize: 2,
  concurrentQueueMaxSize: 2
};

test("Activity aliases are available to the built runtime", () => {
  const imports = backendPackage.imports ?? {};
  for (const alias of ["#activity", "#activity/*"]) {
    assert.ok(alias in imports, `missing package import alias: ${alias}`);
  }
});

const createActivityDouble = (): {
  activity: ActivityCapability;
  queries: ActivityQuery[];
  heartbeatCalls: () => number;
} => {
  const queries: ActivityQuery[] = [];
  let heartbeats = 0;
  const activity: ActivityCapability = {
    publish: async (_transaction: ActivityTransactionInput) => {
      throw new Error("publish is not a public HTTP operation");
    },
    query: async (query) => {
      queries.push(query);
      if (query.type === "activity.transactions") {
        return { type: "activity.transactions", page: { items: [] } };
      }
      if (query.type === "activity.transaction") {
        return { type: "activity.transaction" };
      }
      return { type: "presence.list", leases: [] };
    },
    presence: {
      heartbeat: async () => {
        heartbeats += 1;
        throw new Error("HTTP must not call Presence without a trusted session");
      },
      leave: async () => ({ removed: false }),
      list: async () => [],
      removeExpired: async () => 0
    }
  };
  return { activity, queries, heartbeatCalls: () => heartbeats };
};

test("Activity query endpoint decodes project-history requests", async (t) => {
  const logger = new CapturingLogger();
  const registry = new JobRegistry();
  const { activity, queries } = createActivityDouble();
  registerActivityEndpoints(registry, activity, logger);
  const app = createApp();
  registerHttpTransport(app, {
    scheduler: new JobScheduler(schedulerConfig, logger),
    registry,
    logger
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/activity/query",
    payload: {
      type: "activity.transactions",
      filter: { kind: "document", resourceId: "document-1", limit: 10 }
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(queries, [{
    type: "activity.transactions",
    filter: { kind: "document", resourceId: "document-1", limit: 10 }
  }]);
});

test("Activity Presence commands reject caller-supplied identities until trusted transport exists", async (t) => {
  const logger = new CapturingLogger();
  const registry = new JobRegistry();
  const { activity, heartbeatCalls } = createActivityDouble();
  registerActivityEndpoints(registry, activity, logger);
  const app = createApp();
  registerHttpTransport(app, {
    scheduler: new JobScheduler(schedulerConfig, logger),
    registry,
    logger
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/activity/command",
    payload: {
      type: "presence.heartbeat",
      sessionId: "caller-controlled-session",
      actorId: "caller-controlled-actor",
      state: { cursor: 12 }
    }
  });

  assert.equal(response.statusCode, 501);
  assert.deepEqual(response.json(), {
    error: "presence_transport_unsupported",
    message:
      "Presence commands require a trusted session-aware transport; HTTP does not provide one yet."
  });
  assert.equal(heartbeatCalls(), 0);
});
