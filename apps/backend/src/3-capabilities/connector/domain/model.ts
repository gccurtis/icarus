/**
 * Prose-text extensions — standalone copy owned by this capability.
 * Not imported from any other capability. Lists may intentionally diverge.
 */
export const PROSE_TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "rst", "org", "tex",
  "html", "htm",
  "log",
  "docx",
  "pdf",
]);

export type ConnectorKind =
  | "connector::file::text"
  | "connector::file::other"
  | "connector::directory::text"
  | "connector::directory::other";

/**
 * Allowed sync intervals. Fixed multiples of each other so the scheduler
 * can batch connectors that share a cadence. Values in milliseconds.
 */
export const SYNC_INTERVALS = {
  "5min":   5 * 60 * 1000,        //   300,000 ms
  "30min": 30 * 60 * 1000,        // 1,800,000 ms  (6 × 5min)
  "2hr":    2 * 60 * 60 * 1000,   // 7,200,000 ms  (4 × 30min)
  "12hr":  12 * 60 * 60 * 1000,   // 43,200,000 ms (6 × 2hr)
} as const;

export type SyncInterval = keyof typeof SYNC_INTERVALS;

export interface ConnectorSyncConfig {
  readonly syncType: "scheduled";
  readonly interval: SyncInterval;
  readonly lastSyncedAt?: string;
}

export interface ConnectorEntry {
  /** Stable ID: SHA-256(providerKind + "::" + locator), hex-encoded. */
  readonly id: string;
  readonly kind: ConnectorKind;
  /** Which provider backs this connector. */
  readonly providerKind: string;
  /** Provider-specific external locator (path, URL, connection string, etc.). */
  readonly locator: string;
  /** Display label for the connector. */
  readonly label: string;
  /** Revision counter. Incremented on re-register or refresh. Starts at 1. */
  readonly revision: number;
  /** Sync configuration, if this is a sync-type connector. */
  readonly syncConfig: ConnectorSyncConfig | null;
  /** True while a sync Job is in the queue or actively running. */
  readonly syncing: boolean;
  /** Knowledge source IDs, one per prose item. */
  readonly knowledgeSourceIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt?: string;
}

export interface ConnectorItemEntry {
  /** Provider-scoped key that identifies this item. */
  readonly itemKey: string;
  /** Display name (filename, document title). */
  readonly name: string;
  readonly extension: string;
  readonly byteSize: number;
  /** Provider revision token for change detection. */
  readonly revisionToken: string;
  /** ISO-8601, from stat.mtime. Used for selective sync. */
  readonly lastModifiedAt: string;
  /** Prose vs other — determines Knowledge admission. */
  readonly status: "prose" | "other";
  /** Hashed Knowledge source ID for prose items; null for other items. */
  readonly knowledgeSourceId: string | null;
}

export type RegisterConnectorRequest = {
  providerKind: "filesystem";
  locator: string;
  syncInterval?: SyncInterval;
};

export interface RegisterConnectorResult {
  status: "registered" | "already_exists";
  entry: ConnectorEntry;
  indexResults: ItemIndexResult[];
}

export interface ItemIndexResult {
  itemKey: string;
  name: string;
  status: "indexed" | "stored";
  knowledge?: import("#platform/knowledge/types.js").AddResult;
}

export interface SyncConnectorJobDefinition {
  jobType: "SYNC_CONNECTOR";
  connectorId: string;
  source: "scheduled" | "manual";
}