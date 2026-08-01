import { JobScheduler } from "#utils/jobs/scheduler.js";
import type { BackendConfig } from "#utils/config/loadBackendConfig.js";
import type { Logger } from "#platform/observability/logger.js";

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
