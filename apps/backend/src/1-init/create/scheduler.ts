import { JobScheduler } from "#utils/jobs/scheduler.js";
import type { BackendConfig } from "#utils/config/loadBackendConfig.js";

export const createScheduler = (config: BackendConfig): JobScheduler =>
  // Constructing this object creates the serial and concurrent in-memory
  // queues. Configuration determines queue capacity and concurrent workers.
  new JobScheduler({
    concurrentWorkers: config.workerPool.concurrentWorkers,
    serialQueueMaxSize: config.queue.serialMaxSize,
    concurrentQueueMaxSize: config.queue.concurrentMaxSize
  });
