import { runAuditCapability } from "#capabilities/built-in/auditCapability.js";
import { runEchoCapability } from "#capabilities/built-in/echoCapability.js";
import { runHealthCapability } from "#capabilities/built-in/healthCapability.js";
import { runQueueStatusCapability } from "#capabilities/built-in/queueStatusCapability.js";
import { JobRegistry } from "#workflows/registry.js";
import { JobScheduler } from "#workflows/scheduler.js";

export const registerBuiltInEndpointMappings = (
  registry: JobRegistry,
  scheduler: JobScheduler
): void => {
  // Each registration maps the endpoint actually received by transport to a
  // factory that captures request data and creates a new job.
  registry.register({ method: "GET", path: "/health" }, () => ({
    name: "health",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => ({
      statusCode: 200,
      body: await runHealthCapability()
    })
  }));

  registry.register({ method: "GET", path: "/health/queues" }, () => ({
    name: "queue-status",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => ({
      statusCode: 200,
      body: await runQueueStatusCapability({
          queues: scheduler.getState(),
          registeredEndpoints: registry.listEndpoints()
        })
    })
  }));

  registry.register({ method: "POST", path: "/echo" }, (request) => ({
    name: "echo-inline",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => ({
      statusCode: 200,
      body: await runEchoCapability({
        method: request.method,
        path: request.path,
        body: request.body
      })
    })
  }));

  registry.register({ method: "POST", path: "/audit" }, (request) => ({
    name: "audit-deferred",
    queueType: "serial",
    responseMode: "deferred",

    // This response is created only after the serial queue starts this job.
    deferredWork: async () => ({
      statusCode: 202,
      body: {
        status: "accepted",
        requestId: request.requestId
      }
    }),

    // The scheduler keeps the serial slot until this follow-up work completes.
    work: () =>
      runAuditCapability({
        requestId: request.requestId
      })
  }));
};
