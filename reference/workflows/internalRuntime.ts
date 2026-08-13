import {
  QueueCapacityError,
  type JobScheduler
} from "#workflows/scheduler.js";
import type {
  Job,
  JobDefinition,
  QueueType
} from "#workflows/types.js";

export interface InternalJobIntent {
  readonly type: string;
}

export interface JobDispatchReceipt {
  readonly jobId: string;
  readonly acceptedAt: string;
}

/**
 * Capacity is the one admission failure that is expected to clear without a
 * configuration change. Capabilities can use this predicate without knowing
 * which scheduler or queue owns the intent.
 */
export const isRetryableInternalJobAdmissionError = (
  error: unknown
): boolean => error instanceof QueueCapacityError;

/** The dispatch-only face injected into a capability. */
export interface InternalJobsRuntime<
  TIntent extends InternalJobIntent
> {
  dispatch(intent: TIntent): Promise<JobDispatchReceipt>;
}

/** Internal work has no transport response; queue choice remains in wiring. */
export interface InternalJobDefinition {
  readonly name: string;
  readonly queueType: QueueType;
  readonly work: () => Promise<unknown>;
}

export interface InternalJobsRegistrar<
  TIntent extends InternalJobIntent
> {
  register<TType extends TIntent["type"]>(
    type: TType,
    factory: (
      intent: Extract<TIntent, { type: TType }>
    ) => InternalJobDefinition
  ): void;
}

type InternalJobFactory<TIntent extends InternalJobIntent> = (
  intent: TIntent
) => InternalJobDefinition;

const toIdPrefix = (type: string): string =>
  type.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Scheduler-backed, non-HTTP intent registry and dispatch runtime. */
export class SchedulerInternalJobsRuntime<
  TIntent extends InternalJobIntent
> implements InternalJobsRuntime<TIntent>, InternalJobsRegistrar<TIntent> {
  private readonly factories = new Map<string, InternalJobFactory<TIntent>>();
  private sequence = 0;

  constructor(private readonly scheduler: JobScheduler) {}

  register<TType extends TIntent["type"]>(
    type: TType,
    factory: (
      intent: Extract<TIntent, { type: TType }>
    ) => InternalJobDefinition
  ): void {
    if (this.factories.has(type)) {
      throw new Error(`Internal Job already registered for intent '${type}'`);
    }
    this.factories.set(
      type,
      factory as unknown as InternalJobFactory<TIntent>
    );
  }

  async dispatch(intent: TIntent): Promise<JobDispatchReceipt> {
    const factory = this.factories.get(intent.type);
    if (!factory) {
      throw new Error(`No internal Job registered for intent '${intent.type}'`);
    }

    const definition = factory(intent);
    this.sequence += 1;
    const schedulerDefinition: JobDefinition = {
      name: definition.name,
      queueType: definition.queueType,
      responseMode: "inline",
      work: async () => {
        await definition.work();
        return { statusCode: 204 };
      }
    };
    const job: Job = {
      ...schedulerDefinition,
      id: `internal-${toIdPrefix(intent.type)}-${this.sequence}`
    };
    const admission = this.scheduler.admit(job);

    // Scheduler logging records eventual execution failures. Observe the
    // promise here because dispatch deliberately returns after admission.
    void admission.completion.catch(() => undefined);

    return admission.receipt;
  }
}
