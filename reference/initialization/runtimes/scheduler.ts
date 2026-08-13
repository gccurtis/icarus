import { JobScheduler } from "#workflows/scheduler.js";
import type { BackendConfig } from "#initialization/configuration.js";
import type { Logger } from "#capabilities/observability/logger.js";

export const createScheduler = (
  config: BackendConfig,
  logger: Logger
): JobScheduler =>
  // Constructing this object creates the serial and concurrent in-memory
  // queues. Configuration determines queue capacity and concurrent workers.
  new JobScheduler(
    {
      concurrentWorkers: config.workerPool.concurrentWorkers,
      serialQueueMaxSize: config.queue.serialMaxSize,
      concurrentQueueMaxSize: config.queue.concurrentMaxSize
    },
    logger
  );
