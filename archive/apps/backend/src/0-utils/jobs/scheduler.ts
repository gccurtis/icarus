import type {
  Job,
  JobAdmission,
  JobExecutionResult,
  JobResponse,
  JobSchedulerState,
  QueueType
} from "#utils/jobs/types.js";
import { setImmediate as yieldToEventLoop } from "node:timers/promises";

interface QueueItem {
  job: Job;
  resolve: (value: JobExecutionResult) => void;
  reject: (reason: unknown) => void;
  enqueuedAt: number;
}

export interface JobSchedulerLogger {
  debug(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

const NOOP_LOGGER: JobSchedulerLogger = {
  debug: () => undefined,
  warn: () => undefined,
  error: () => undefined
};

const errorFields = (error: unknown): Record<string, unknown> =>
  error instanceof Error
    ? { errorName: error.name, errorMessage: error.message }
    : { errorName: "UnknownError", errorMessage: String(error) };

export interface JobSchedulerConfig {
  concurrentWorkers: number;
  serialQueueMaxSize: number;
  concurrentQueueMaxSize: number;
}

export class QueueCapacityError extends Error {
  readonly queueType: QueueType;

  constructor(queueType: QueueType, message: string) {
    super(message);
    this.name = "QueueCapacityError";
    this.queueType = queueType;
  }
}

export class JobScheduler {
  private readonly config: JobSchedulerConfig;

  // These arrays are the two in-memory queues. A job lives in exactly one.
  private readonly serialQueue: QueueItem[] = [];
  private readonly concurrentQueue: QueueItem[] = [];

  // Active counts include deferred jobs until their follow-up work completes.
  private serialActive = false;
  private concurrentActive = 0;

  constructor(
    config: JobSchedulerConfig,
    private readonly logger: JobSchedulerLogger = NOOP_LOGGER
  ) {
    this.config = config;
  }

  async enqueue(job: Job): Promise<JobExecutionResult> {
    return this.admit(job).completion;
  }

  /**
   * Admit a Job without coupling the caller to its eventual completion.
   *
   * Capacity is decided synchronously. This lets internal continuation
   * dispatch report queue admission while durable capability state remains
   * the authority for retry and recovery.
   */
  admit(job: Job): JobAdmission {
    const queue = job.queueType === "serial"
      ? this.serialQueue
      : this.concurrentQueue;
    const queueMaxSize = job.queueType === "serial"
      ? this.config.serialQueueMaxSize
      : this.config.concurrentQueueMaxSize;

    if (queue.length >= queueMaxSize) {
      this.logger.warn("job.queue.capacity", {
        jobId: job.id,
        jobName: job.name,
        queueType: job.queueType,
        queueDepth: queue.length,
        queueMaxSize
      });
      throw new QueueCapacityError(
        job.queueType,
        job.queueType === "serial"
          ? "Serial queue is full"
          : "Concurrent queue is full"
      );
    }

    let resolveCompletion!: (value: JobExecutionResult) => void;
    let rejectCompletion!: (reason: unknown) => void;
    const completion = new Promise<JobExecutionResult>((resolve, reject) => {
      resolveCompletion = resolve;
      rejectCompletion = reject;
    });
    const item: QueueItem = {
      job,
      resolve: resolveCompletion,
      reject: rejectCompletion,
      enqueuedAt: performance.now()
    };

    queue.push(item);
    this.logEnqueued(item);
    if (job.queueType === "serial") {
      this.tryRunSerial();
    } else {
      this.tryRunConcurrent();
    }

    return {
      receipt: {
        jobId: job.id,
        acceptedAt: new Date().toISOString()
      },
      completion
    };
  }

  getState(): JobSchedulerState {
    return {
      serialDepth: this.serialQueue.length,
      serialActive: this.serialActive,
      concurrentDepth: this.concurrentQueue.length,
      concurrentActive: this.concurrentActive,
      concurrentWorkers: this.config.concurrentWorkers
    };
  }

  private tryRunSerial(): void {
    if (this.serialActive) {
      return;
    }

    const item = this.serialQueue.shift();
    if (!item) {
      return;
    }

    this.serialActive = true;

    // serialActive stays true for the entire job lifecycle, including any
    // deferred work that runs after its HTTP response becomes available.
    void this.execute(item)
      .catch(item.reject)
      .finally(() => {
        this.serialActive = false;
        this.tryRunSerial();
      });
  }

  private tryRunConcurrent(): void {
    while (
      this.concurrentActive < this.config.concurrentWorkers &&
      this.concurrentQueue.length > 0
    ) {
      const item = this.concurrentQueue.shift();
      if (!item) {
        return;
      }

      this.concurrentActive += 1;

      // Each executing job occupies one worker until all of its work ends.
      void this.execute(item)
        .catch(item.reject)
        .finally(() => {
          this.concurrentActive -= 1;
          this.tryRunConcurrent();
        });
    }
  }

  private async execute(item: QueueItem): Promise<void> {
    const startedAt = performance.now();
    const common = {
      jobId: item.job.id,
      ...(item.job.requestId ? { requestId: item.job.requestId } : {}),
      jobName: item.job.name,
      queueType: item.job.queueType,
      responseMode: item.job.responseMode,
      queueWaitMs: Math.round(startedAt - item.enqueuedAt)
    };
    this.logger.debug("job.started", common);

    try {
      if (item.job.responseMode === "inline") {
        const response = await item.job.work();
        item.resolve(this.createExecutionResult(item.job, response));
        this.logger.debug("job.completed", {
          ...common,
          statusCode: response.statusCode,
          durationMs: Math.round(performance.now() - startedAt)
        });
        return;
      }

      // A deferred response is not created at enqueue time. It is created only
      // after this job reaches the front of its selected queue and starts.
      const response = await item.job.deferredWork();
      item.resolve(this.createExecutionResult(item.job, response));
      this.logger.debug("job.responded", {
        ...common,
        statusCode: response.statusCode,
        responseDurationMs: Math.round(performance.now() - startedAt)
      });

      // Give transport's awaiting handler a turn to send the response before
      // beginning follow-up work. The queue slot intentionally remains active.
      await yieldToEventLoop();

      try {
        await item.job.work();
        this.logger.debug("job.completed", {
          ...common,
          statusCode: response.statusCode,
          durationMs: Math.round(performance.now() - startedAt)
        });
      } catch (error) {
        // The HTTP response has already been produced, so this failure cannot
        // change it. Record it through the shared logger while allowing the
        // queue to drain.
        this.logger.error("job.deferred.failed", {
          ...common,
          durationMs: Math.round(performance.now() - startedAt),
          ...errorFields(error)
        });
      }
    } catch (error) {
      this.logger.error("job.failed", {
        ...common,
        durationMs: Math.round(performance.now() - startedAt),
        ...errorFields(error)
      });
      throw error;
    }
  }

  private logEnqueued(item: QueueItem): void {
    this.logger.debug("job.enqueued", {
      jobId: item.job.id,
      jobName: item.job.name,
      queueType: item.job.queueType,
      responseMode: item.job.responseMode,
      serialDepth: this.serialQueue.length,
      concurrentDepth: this.concurrentQueue.length,
      serialActive: this.serialActive,
      concurrentActive: this.concurrentActive
    });
  }

  private createExecutionResult(
    job: Job,
    response: JobResponse
  ): JobExecutionResult {
    return {
      jobId: job.id,
      ...(job.requestId ? { requestId: job.requestId } : {}),
      jobName: job.name,
      queueType: job.queueType,
      respondedAt: new Date().toISOString(),
      response
    };
  }
}
