import type { ConnectorReader } from "./reader.js";

export interface ConnectorItem {
  /** Provider-scoped key that uniquely identifies this item within the locator. */
  readonly key: string;
  /** Display name (filename, document title, etc.). */
  readonly name: string;
  /** File extension, lowercased, or null. */
  readonly extension: string | null;
  /** Byte size, if known. -1 if unknown. */
  readonly byteSize: number;
  /** Revision token for change detection (mtime, etag, version hash, etc.). */
  readonly revisionToken: string;
  /**
   * Whether this item is prose text (admitted to Knowledge) or other
   * (registered but not indexed). Classification uses a standalone copy
   * of the prose-text extension list owned by this capability.
   */
  readonly status: "prose" | "other";
}

/**
 * A provider's job: given an external locator, list the items available
 * and produce readers for them. Providers are stateless — every call
 * re-connects to the external system.
 */
export interface ConnectorProvider {
  /** Machine-readable provider kind. */
  readonly kind: string;

  /** Human-readable label for diagnostics and UI. */
  readonly label: string;

  /**
   * List all items at the given locator. Each item is classified as
   * "prose" or "other" based on extension.
   */
  listItems(locator: string): Promise<ConnectorItem[]>;

  /**
   * Produce a reader for a specific item. The locator and itemKey together
   * uniquely identify the item within this provider.
   */
  getReader(locator: string, itemKey: string): Promise<ConnectorReader>;
}

export interface ConnectorItem {
  /** Provider-scoped key that uniquely identifies this item within the locator. */
  readonly key: string;
  /** Display name (filename, document title, etc.). */
  readonly name: string;
  /** File extension, lowercased, or null. */
  readonly extension: string | null;
  /** Byte size, if known. -1 if unknown. */
  readonly byteSize: number;
  /** Revision token for change detection (mtime, etag, version hash, etc.). */
  readonly revisionToken: string;
  /**
   * Whether this item is prose text (admitted to Knowledge) or other
   * (registered but not indexed). Classification uses a standalone copy
   * of the prose-text extension list owned by this capability.
   */
  readonly status: "prose" | "other";
}

export type SyncIntent =
  | { kind: "add"; item: ConnectorItem }
  | { kind: "update"; itemKey: string; revisionToken: string }
  | { kind: "remove"; itemKey: string };

/**
 * A sync-type provider supports automatic periodic refresh on a fixed schedule.
 */
export interface SyncConnectorProvider extends ConnectorProvider {
  readonly syncType: "scheduled";

  /**
   * Called by the sync Job handler at each scheduled or manual sync.
   * The provider stats every known item, compares mtime against stored
   * lastModifiedAt, and returns intents only for items that changed,
   * were added, or were removed.
   */
  sync(locator: string): Promise<SyncIntent[]>;
}