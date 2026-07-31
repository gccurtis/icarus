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
  }

  unregister(entryId: string): void {
    this.entries.delete(entryId);
  }

  start(): void {
    // Group entries by interval
    const byInterval = new Map<SyncInterval, string[]>();
    for (const e of this.entries.values()) {
      const ids = byInterval.get(e.interval) ?? [];
      ids.push(e.id);
      byInterval.set(e.interval, ids);
    }

    for (const [interval, connectorIds] of byInterval) {
      const ms = SYNC_INTERVALS[interval as SyncInterval];
      const timer = setInterval(() => {
        for (const connectorId of connectorIds) {
          this.enqueueSyncJob(connectorId);
        }
      }, ms);

      this.intervals.set(interval as SyncInterval, timer);
      this.logger.info("connector.sync.scheduler.started", { interval, connectors: connectorIds.length });
    }
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
          await this.connectorService.sync(connectorId);
          return { statusCode: 200, body: { status: "synced" } };
        } catch (e) {
          this.logger.error("connector.sync.scheduled.error", { connectorId, error: String(e) });
          return { statusCode: 500, body: { status: "error" } };
        }
      },
    };

    this.scheduler.enqueue({ ...job, id: `sync-${connectorId}-${Date.now()}` }).catch(() => {
      this.store.clearSyncing(connectorId);
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