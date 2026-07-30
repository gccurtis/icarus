import type { Job, JobFactory, JobExecutionResult, QueueType } from "#utils/jobs/types.js";
import type { RequestEndpoint, RequestEnvelope } from "#utils/types/request.js";

export class JobRegistry {
  // Endpoint keys such as "POST /echo" resolve to factories, not shared jobs.
  // A fresh job is created for every incoming request.
  private factories = new Map<string, JobFactory>();
  private sequence = 0;

  register(endpoint: RequestEndpoint, factory: JobFactory): void {
    const key = this.getEndpointKey(endpoint);
    if (this.factories.has(key)) {
      throw new Error(`Job already registered for endpoint '${key}'`);
    }

    this.factories.set(key, factory);
  }

  has(endpoint: RequestEndpoint): boolean {
    return this.factories.has(this.getEndpointKey(endpoint));
  }

  createJob(request: RequestEnvelope): Job {
    const key = this.getEndpointKey(request);
    const factory = this.factories.get(key);
    if (!factory) {
      throw new Error(`No job registered for endpoint '${key}'`);
    }

    // Job wiring receives the normalized request here and captures whatever
    // request data its work functions need in a new concrete job.
    const job = factory(request);
    this.sequence += 1;

    return {
      ...job,
      id: `${this.toIdPrefix(key)}-${this.sequence}`
    };
  }

  listEndpoints(): string[] {
    return Array.from(this.factories.keys()).sort();
  }

  private getEndpointKey(endpoint: RequestEndpoint): string {
    return `${endpoint.method.toUpperCase()} ${endpoint.path}`;
  }

  private toIdPrefix(endpointKey: string): string {
    return endpointKey.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
}

export type { Job, JobFactory, JobExecutionResult, QueueType };
