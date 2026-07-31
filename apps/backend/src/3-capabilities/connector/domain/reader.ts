export interface ByteRange {
  start: number; // 0-based, inclusive
  end: number;   // exclusive
}

/**
 * On-demand reader for a connector item. Constructed per-read —
 * no handles or connections are kept open.
 */
export interface ConnectorReader {
  /** Total byte size of the item, or -1 if unknown. */
  readonly byteSize: number;
  /** MIME type, if known. */
  readonly mimeType: string | null;

  /** Read a bounded range of bytes. Returns UTF-8 text. */
  read(range: ByteRange): Promise<string>;

  /** Read the entire item as UTF-8 text. Use with caution for large items. */
  readAll(): Promise<string>;

  /** Read the item as a stream of text chunks. */
  readStream(chunkSize?: number): AsyncIterable<string>;

  /**
   * Read a range of lines. Line numbers are 1-based, inclusive on both ends.
   */
  readLines(startLine: number, endLine: number): Promise<string[]>;
}

import type { ConnectorItemEntry } from "./model.js";

export interface DirectoryReader {
  /** List all items in the directory (prose + other). */
  listItems(): ConnectorItemEntry[];

  /** Get a ConnectorReader for a specific indexed item by its key. */
  getItemReader(itemKey: string): Promise<ConnectorReader>;
}