import type { Logger } from "#capabilities/observability/logger.js";
import type { RetentionConfig } from "#initialization/configuration.js";
import type { ResourceRetentionPort } from "#shared/persistence/resourceHistory.js";

const DAY_MS = 24 * 60 * 60 * 1_000;
const HOUR_MS = 60 * 60 * 1_000;

export interface ResourceRetentionClock {
  now(): Date;
}

export interface ResourceRetentionTarget {
  pruneHistory(cutoff: string): Promise<number> | number;
  purgeExpired(cutoff: string): Promise<number> | number;
}

export interface ResourceRetentionSweepResult {
  readonly cutoff: string;
  readonly purged: number;
  readonly pruned: number;
  readonly failures: number;
}

const systemClock: ResourceRetentionClock = { now: () => new Date() };

/**
 * Binds capability methods without leaking their receiver. This also keeps the
 * composition root independent of every capability's concrete retention type.
 */
export const bindResourceRetentionPort = (
  capability: string,
  target: ResourceRetentionTarget
): ResourceRetentionPort => ({
  capability,
  pruneHistory: (cutoff) => target.pruneHistory(cutoff),
  purgeExpired: (cutoff) => target.purgeExpired(cutoff)
});

/**
 * Runs every capability in a deterministic sequence. Each purge and prune is
 * isolated so one resource or capability cannot abort the rest of the sweep.
 */
export class ResourceRetentionScheduler {
  private timer: ReturnType<typeof setInterval> | undefined;
  private inFlight: Promise<ResourceRetentionSweepResult> | undefined;
  private started = false;

  constructor(
    private readonly config: RetentionConfig,
    private readonly ports: readonly ResourceRetentionPort[],
    private readonly logger: Logger,
    private readonly clock: ResourceRetentionClock = systemClock
  ) {}

  /** Run the startup sweep and then arm the recurring timer. */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    await this.runNow();
    if (!this.started) return;

    const intervalMs = this.config.sweepIntervalHours * HOUR_MS;
    this.timer = setInterval(() => {
      void this.runNow();
    }, intervalMs);
    this.timer.unref();
    this.logger.info("retention.scheduler.started", {
      revisionRetentionDays: this.config.revisionRetentionDays,
      sweepIntervalHours: this.config.sweepIntervalHours
    });
  }

  /** Clear the recurring timer and wait for any active sweep to settle. */
  async stop(): Promise<void> {
    this.started = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    await this.inFlight;
    this.logger.info("retention.scheduler.stopped");
  }

  /** Public for deterministic startup and injected-clock tests. */
  runNow(): Promise<ResourceRetentionSweepResult> {
    if (this.inFlight) return this.inFlight;
    const sweep = this.runSweep();
    this.inFlight = sweep;
    const clearInFlight = (): void => {
      if (this.inFlight === sweep) this.inFlight = undefined;
    };
    void sweep.then(clearInFlight, clearInFlight);
    return sweep;
  }

  private async runSweep(): Promise<ResourceRetentionSweepResult> {
    const startedAt = performance.now();
    const cutoff = new Date(
      this.clock.now().getTime() - this.config.revisionRetentionDays * DAY_MS
    ).toISOString();
    let purged = 0;
    let pruned = 0;
    let failures = 0;

    this.logger.info("retention.sweep.started", { cutoff });
    for (const port of this.ports) {
      let capabilityPurged = 0;
      let capabilityPruned = 0;

      try {
        capabilityPurged = await port.purgeExpired(cutoff);
        purged += capabilityPurged;
      } catch (error) {
        failures += 1;
        this.logFailure(port.capability, "purge", cutoff, error);
      }

      try {
        capabilityPruned = await port.pruneHistory(cutoff);
        pruned += capabilityPruned;
      } catch (error) {
        failures += 1;
        this.logFailure(port.capability, "prune", cutoff, error);
      }

      this.logger.info("retention.capability.completed", {
        capability: port.capability,
        cutoff,
        purged: capabilityPurged,
        pruned: capabilityPruned
      });
    }

    const result: ResourceRetentionSweepResult = {
      cutoff,
      purged,
      pruned,
      failures
    };
    this.logger.info("retention.sweep.completed", {
      ...result,
      durationMs: Math.round(performance.now() - startedAt)
    });
    return result;
  }

  private logFailure(
    capability: string,
    operation: "purge" | "prune",
    cutoff: string,
    error: unknown
  ): void {
    this.logger.error("retention.capability.failed", {
      capability,
      operation,
      cutoff,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error)
    });
  }
}
