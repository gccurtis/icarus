// ConnectorSyncScheduler — thin interval-based scheduler that enqueues
// SYNC_CONNECTOR Jobs through the JobScheduler. Does not touch providers
// or content directly.

import type { Logger } from "#platform/observability/logger.js";
import { SYNC_INTERVALS, type ConnectorSyncConfig, type SyncInterval } from "#connector";
import type { ConnectorStore } from "#connector";
import type { ConnectorService } from "#connector";
import type { JobScheduler } from "#utils/jobs/scheduler.js";
import type { JobDefinition } from "#utils/jobs/types.js";

export class ConnectorSyncScheduler {
  private intervals: Map<SyncInterval, ReturnType<typeof setInterval>> = new Map();
  private entries: Map<string, { id: string; interval: SyncInterval }> = new Map();

  constructor(
    private readonly store: ConnectorStore,
    private readonly scheduler: JobScheduler,
    private readonly connectorService: ConnectorService,
    private readonly logger: Logger,
  ) {}

  register(entryId: string, config: ConnectorSyncConfig): void {
    this.entries.set(entryId, { id: entryId, interval: config.interval });
    this.logger.info("connector.sync.scheduler.registered", {
      connectorId: entryId,
      interval: config.interval,
    });
  }

  unregister(entryId: string): void {
    this.entries.delete(entryId);
    this.logger.info("connector.sync.scheduler.unregistered", { connectorId: entryId });
  }

  start(): void {
    if (this.intervals.size > 0) return;

    // Load persisted registrations immediately. Every tick refreshes this
    // snapshot so connectors registered after startup join without requiring a
    // composition-layer callback.
    const recovered = this.store.resetSyncing();
    this.logger.info("connector.sync.scheduler.recovered", { connectors: recovered });
    this.refreshEntries();

    for (const interval of Object.keys(SYNC_INTERVALS) as SyncInterval[]) {
      const ms = SYNC_INTERVALS[interval];
      const timer = setInterval(() => {
        this.refreshEntries();
        for (const entry of this.entries.values()) {
          if (entry.interval === interval) this.enqueueSyncJob(entry.id);
        }
      }, ms);

      this.intervals.set(interval, timer);
      this.logger.info("connector.sync.scheduler.started", {
        interval,
        intervalMs: ms,
        connectors: [...this.entries.values()].filter(entry => entry.interval === interval).length,
      });
    }
  }

  private refreshEntries(): void {
    const entries = this.store.listSyncableEntries();
    this.entries.clear();
    for (const entry of entries) {
      if (entry.syncConfig?.syncType === "scheduled") {
        this.entries.set(entry.id, { id: entry.id, interval: entry.syncConfig.interval });
      }
    }
    this.logger.debug("connector.sync.scheduler.discovered", { connectors: entries.length });
  }

  private enqueueSyncJob(connectorId: string): void {
    // Check syncing state — if already syncing, skip
    const entry = this.store.getById(connectorId);
    if (!entry || entry.deletedAt || !entry.syncConfig) return;
    if (entry.syncing) return;

    // Set syncing at enqueue time
    const acquired = this.store.setSyncing(connectorId);
    if (!acquired) return;

    const job: JobDefinition = {
      name: "connector.sync.scheduled",
      queueType: "concurrent",
      responseMode: "inline",
      work: async () => {
        try {
          await this.connectorService.sync(connectorId, true);
          return { statusCode: 200, body: { status: "synced" } };
        } catch (e) {
          this.logger.error("connector.sync.scheduled.error", { connectorId, error: String(e) });
          return { statusCode: 500, body: { status: "error" } };
        }
      },
    };

    this.scheduler.enqueue({ ...job, id: `sync-${connectorId}-${Date.now()}` }).catch((error) => {
      this.store.clearSyncing(connectorId);
      this.logger.error("connector.sync.scheduler.enqueue-failed", {
        connectorId,
        errorName: error instanceof Error ? error.name : "UnknownError",
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  stop(): void {
    for (const timer of this.intervals.values()) {
      clearInterval(timer);
    }
    this.intervals.clear();
    this.logger.info("connector.sync.scheduler.stopped");
  }
}
