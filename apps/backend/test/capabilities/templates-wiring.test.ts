import assert from "node:assert/strict";
import test from "node:test";
import { JobRegistry } from "../../src/0-utils/jobs/registry.js";
import { JobScheduler } from "../../src/0-utils/jobs/scheduler.js";
import {
  StaleTemplateRevisionError,
  TemplateNameConflictError,
  type TemplateCapability,
  type TemplateCommandRequest,
  type TemplateQueryRequest
} from "../../src/3-capabilities/templates/index.js";
import { registerTemplateEndpoints } from "../../src/4-job-wiring/templates/registerTemplateEndpoints.js";
import { CapturingLogger } from "../helpers/testDoubles.js";

const schedulerConfig = {
  concurrentWorkers: 1,
  serialQueueMaxSize: 4,
  concurrentQueueMaxSize: 4
};

const createTemplatesDouble = (fail?: () => never): TemplateCapability => ({
  command: async (_request: TemplateCommandRequest) => {
    fail?.();
    return { type: "template.deleted", templateId: "t-1", revision: 2 };
  },
  query: async (_request: TemplateQueryRequest) => {
    fail?.();
    return { type: "template.records", templates: [] };
  },
  publishPendingActivity: async () => 0,
  pruneHistory: async () => 0,
  purgeExpired: async () => 0
});

const buildRegistry = (fail?: () => never): JobRegistry => {
  const logger = new CapturingLogger();
  const registry = new JobRegistry(new JobScheduler(schedulerConfig, logger));
  registerTemplateEndpoints(registry, createTemplatesDouble(fail), logger);
  return registry;
};

test("Template mutations run on the serial queue and reads on the concurrent queue", () => {
  const registry = buildRegistry();

  // A command mutates, and the service reads-then-writes across claim and
  // adapter execution that no single statement makes atomic. Serial admission
  // is what keeps duplicate adapter calls from concurrent retries safe.
  const envelope = (path: string) => ({
    method: "POST",
    path,
    requestId: "req-1",
    params: {},
    query: {},
    headers: {},
    body: {}
  });

  assert.equal(registry.createJob(envelope("/templates/command")).queueType, "serial");
  assert.equal(registry.createJob(envelope("/templates/query")).queueType, "concurrent");
});

test("Template conflicts map to distinguishable 409 codes", async (t) => {
  // A wire-valid body: decoding runs before the service, so an empty one would
  // 400 at the boundary and never reach the error being tested.
  const envelope = {
    method: "POST",
    path: "/templates/command",
    requestId: "req-1",
    params: {},
    query: {},
    headers: {},
    body: {
      requestId: "req-1",
      origin: "user",
      command: { type: "template.delete", templateId: "t-1" }
    }
  };

  const cases = [
    {
      label: "a taken catalog name",
      error: () => {
        throw new TemplateNameConflictError("document", "Quarterly report");
      },
      code: "name_conflict"
    },
    {
      label: "a stale expectedRevision",
      error: () => {
        throw new StaleTemplateRevisionError("t-1", 1, 3);
      },
      code: "revision_conflict"
    }
  ] as const;

  for (const { label, error, code } of cases) {
    await t.test(`${label} answers 409 ${code}`, async () => {
      const job = buildRegistry(error as () => never).createJob(envelope);
      const response = await job.work?.();
      assert.equal(response?.statusCode, 409);
      // Distinct codes matter: a caller retries a revision conflict by
      // re-reading, but a name conflict needs a different name.
      assert.equal((response?.body as { error: string }).error, code);
    });
  }
});
