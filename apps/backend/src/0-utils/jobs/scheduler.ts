import type {
  Job,
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
}

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

  constructor(config: JobSchedulerConfig) {
    this.config = config;
  }

  enqueue(job: Job): Promise<JobExecutionResult> {
    return new Promise<JobExecutionResult>((resolve, reject) => {
      const item: QueueItem = { job, resolve, reject };

      // queueType is the single mapping from a concrete job to its queue.
      if (job.queueType === "serial") {
        if (this.serialQueue.length >= this.config.serialQueueMaxSize) {
          reject(new QueueCapacityError("serial", "Serial queue is full"));
          return;
        }

        this.serialQueue.push(item);
        this.tryRunSerial();
        return;
      }

      if (this.concurrentQueue.length >= this.config.concurrentQueueMaxSize) {
        reject(new QueueCapacityError("concurrent", "Concurrent queue is full"));
        return;
      }

      this.concurrentQueue.push(item);
      this.tryRunConcurrent();
    });
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
    if (item.job.responseMode === "inline") {
      const response = await item.job.work();
      item.resolve(this.createExecutionResult(item.job, response));
      return;
    }

    // A deferred response is not created at enqueue time. It is created only
    // after this job reaches the front of its selected queue and starts.
    const response = await item.job.deferredWork();
    item.resolve(this.createExecutionResult(item.job, response));

    // Give transport's awaiting handler a turn to send the response before
    // beginning follow-up work. The queue slot intentionally remains active.
    await yieldToEventLoop();

    try {
      await item.job.work();
    } catch (error) {
      // The HTTP response has already been produced, so this failure cannot
      // change it. Keep the failure visible while allowing the queue to drain.
      console.error(`Deferred work failed for job '${item.job.id}'`, error);
    }
  }

  private createExecutionResult(
    job: Job,
    response: JobResponse
  ): JobExecutionResult {
    return {
      jobId: job.id,
      jobName: job.name,
      queueType: job.queueType,
      respondedAt: new Date().toISOString(),
      response
    };
  }
}
