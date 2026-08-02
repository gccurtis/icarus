import assert from "node:assert/strict";
import test from "node:test";
import { JobRegistry } from "../../src/0-utils/jobs/registry.js";
import { JobScheduler } from "../../src/0-utils/jobs/scheduler.js";
import type {
  TemplateCapability,
  TemplateCommandRequest,
  TemplateQueryRequest
} from "../../src/3-capabilities/templates/index.js";
import { registerTemplateEndpoints } from "../../src/4-job-wiring/templates/registerTemplateEndpoints.js";
import { CapturingLogger } from "../helpers/testDoubles.js";

const schedulerConfig = {
  concurrentWorkers: 1,
  serialQueueMaxSize: 4,
  concurrentQueueMaxSize: 4
};

const createTemplatesDouble = (): TemplateCapability => ({
  command: async (_request: TemplateCommandRequest) => ({
    type: "template.deleted",
    templateId: "t-1"
  }),
  query: async (_request: TemplateQueryRequest) => ({
    type: "template.records",
    templates: []
  }),
  publishPendingActivity: async () => 0
});

const buildRegistry = (): JobRegistry => {
  const logger = new CapturingLogger();
  const registry = new JobRegistry(new JobScheduler(schedulerConfig, logger));
  registerTemplateEndpoints(registry, createTemplatesDouble(), logger);
  return registry;
};

test("Template mutations run on the serial queue and reads on the concurrent queue", () => {
  const registry = buildRegistry();

  // A command mutates, and the service reads-then-writes across several store
  // calls (countLive then reserve, claim then execute) that no single statement
  // makes atomic. Serial admission is what keeps those safe.
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
