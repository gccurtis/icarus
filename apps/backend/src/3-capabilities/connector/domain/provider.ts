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

  /** Opt into the shared scheduler; the service owns snapshot diffing. */
  readonly syncType?: "scheduled";

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
