import type { RequestEnvelope } from "#api/context.js";

export type QueueType = "serial" | "concurrent";

export type ResponseMode = "inline" | "deferred";

/** Everything transport needs in order to send the response chosen by a job. */
export interface JobResponse {
  statusCode: number;
  body?: unknown;
  headers?: Record<string, string>;
}

interface BaseJobDefinition {
  name: string;
  queueType: QueueType;
}

/** Waits for all work to finish, then returns the response. */
export interface InlineJobDefinition extends BaseJobDefinition {
  responseMode: "inline";
  work: () => Promise<JobResponse>;
}

/**
 * Returns a response when dequeued, then keeps its queue slot while work runs.
 */
export interface DeferredJobDefinition extends BaseJobDefinition {
  responseMode: "deferred";
  deferredWork: () => Promise<JobResponse>;
  work: () => Promise<unknown>;
}

export type JobDefinition = InlineJobDefinition | DeferredJobDefinition;
export type Job = JobDefinition & {
  id: string;
  /** Transport correlation ID when the job originated from a request. */
  requestId?: string;
};

export interface JobExecutionResult {
  jobId: string;
  requestId?: string;
  jobName: string;
  queueType: QueueType;
  respondedAt: string;
  response: JobResponse;
}

/** A Job has entered its selected in-memory queue. */
export interface JobAdmissionReceipt {
  jobId: string;
  acceptedAt: string;
}

/** Queue admission is immediate; execution completes independently. */
export interface JobAdmission {
  receipt: JobAdmissionReceipt;
  completion: Promise<JobExecutionResult>;
}

export interface JobSchedulerState {
  serialDepth: number;
  serialActive: boolean;
  concurrentDepth: number;
  concurrentActive: number;
  concurrentWorkers: number;
}

export type JobFactory = (request: RequestEnvelope) => JobDefinition;
