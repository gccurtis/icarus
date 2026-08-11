// Local filesystem connector provider.
// DEVELOPMENT ONLY: this adapter deliberately exposes paths readable by the
// backend process. Production deployments should use an authenticated,
// policy-constrained provider instead.
// The ConnectorService calls listItems() and diffs against stored items for sync.
// mtime-based revision tokens enable selective sync (only changed items re-read).

import { stat, readdir, open } from "node:fs/promises";
import { resolve, basename, extname } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { PROSE_TEXT_EXTENSIONS } from "../domain/model.js";
import type { ConnectorProvider, ConnectorItem } from "../domain/provider.js";
import type { ConnectorReader, ByteRange } from "../domain/reader.js";
import { UnsupportedLocatorError } from "../domain/errors.js";

const MAX_RANGE_BYTES = 1024 * 1024;
const MAX_FULL_READ_BYTES = 16 * 1024 * 1024;
const MAX_STREAM_CHUNK_BYTES = 1024 * 1024;
const MAX_LINE_RANGE = 10_000;

function assertInteger(name: string, value: number, minimum: number): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`${name} must be a safe integer >= ${minimum}`);
  }
}

function classifyExtension(extension: string): "prose" | "other" {
  return PROSE_TEXT_EXTENSIONS.has(extension) ? "prose" : "other";
}

function fileToItem(filePath: string, st: { mtimeMs: number; size: number }): ConnectorItem {
  const name = basename(filePath);
  const ext = extname(name).slice(1).toLowerCase();
  return {
    key: filePath,
    name,
    extension: ext || null,
    byteSize: st.size,
    revisionToken: `${st.mtimeMs}-${st.size}`,
    status: ext ? classifyExtension(ext) : "other",
  };
}

/**
 * A ConnectorReader backed by a local file. Opens and closes the file
 * handle per read operation — no handles are kept open between calls.
 */
class FileConnectorReader implements ConnectorReader {
  public readonly byteSize: number;
  public readonly mimeType: string | null = null;

  constructor(private readonly filePath: string, byteSize: number) {
    this.byteSize = byteSize;
  }

  async read(range: ByteRange): Promise<string> {
    assertInteger("range.start", range.start, 0);
    assertInteger("range.end", range.end, 0);
    if (range.end < range.start) {
      throw new RangeError("range.end must be greater than or equal to range.start");
    }
    if (range.end > this.byteSize) {
      throw new RangeError(`range.end exceeds byteSize (${this.byteSize})`);
    }
    const length = range.end - range.start;
    if (length > MAX_RANGE_BYTES) {
      throw new RangeError(`range exceeds maximum size (${MAX_RANGE_BYTES} bytes)`);
    }

    const fd = await open(this.filePath, "r");
    try {
      const buf = Buffer.allocUnsafe(length);
      const { bytesRead } = await fd.read(buf, 0, buf.length, range.start);
      return buf.subarray(0, bytesRead).toString("utf8");
    } finally {
      await fd.close();
    }
  }

  async readAll(): Promise<string> {
    const fd = await open(this.filePath, "r");
    try {
      const st = await fd.stat();
      if (st.size > MAX_FULL_READ_BYTES) {
        throw new RangeError(`file exceeds maximum full-read size (${MAX_FULL_READ_BYTES} bytes)`);
      }
      const chunks: Buffer[] = [];
      let offset = 0;
      while (offset < st.size) {
        const buf = Buffer.allocUnsafe(Math.min(65536, st.size - offset));
        const { bytesRead } = await fd.read(buf, 0, buf.length, offset);
        if (bytesRead === 0) break;
        chunks.push(buf.subarray(0, bytesRead));
        offset += bytesRead;
      }
      return Buffer.concat(chunks).toString("utf8");
    } finally {
      await fd.close();
    }
  }

  async *readStream(chunkSize: number = 65536): AsyncIterable<string> {
    assertInteger("chunkSize", chunkSize, 1);
    if (chunkSize > MAX_STREAM_CHUNK_BYTES) {
      throw new RangeError(`chunkSize exceeds maximum (${MAX_STREAM_CHUNK_BYTES} bytes)`);
    }
    const fd = await open(this.filePath, "r");
    const decoder = new StringDecoder("utf8");
    try {
      const st = await fd.stat();
      let offset = 0;
      while (offset < st.size) {
        const buf = Buffer.allocUnsafe(Math.min(chunkSize, st.size - offset));
        const { bytesRead } = await fd.read(buf, 0, buf.length, offset);
        if (bytesRead === 0) break;
        offset += bytesRead;
        const text = decoder.write(buf.subarray(0, bytesRead));
        if (text.length > 0) yield text;
      }
      const tail = decoder.end();
      if (tail.length > 0) yield tail;
    } finally {
      await fd.close();
    }
  }

  async readLines(startLine: number, endLine: number): Promise<string[]> {
    assertInteger("startLine", startLine, 1);
    assertInteger("endLine", endLine, 1);
    if (endLine < startLine) {
      throw new RangeError("endLine must be greater than or equal to startLine");
    }
    if (endLine - startLine + 1 > MAX_LINE_RANGE) {
      throw new RangeError(`line range exceeds maximum (${MAX_LINE_RANGE} lines)`);
    }
    const full = await this.readAll();
    const lines = full.split("\n");
    return lines.slice(startLine - 1, endLine);
  }
}

export const filesystemProvider: ConnectorProvider = {
  kind: "filesystem",
  label: "Local Filesystem (development only)",
  syncType: "scheduled",

  async listItems(locator: string): Promise<ConnectorItem[]> {
    const resolved = resolve(locator);
    const st = await stat(resolved);

    if (st.isFile()) {
      return [fileToItem(resolved, st)];
    }

    if (st.isDirectory()) {
      const entries = await readdir(resolved, { withFileTypes: true });
      const items: ConnectorItem[] = [];
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const filePath = resolve(resolved, entry.name);
        const fileStat = await stat(filePath);
        items.push(fileToItem(filePath, fileStat));
      }
      return items;
    }

    throw new UnsupportedLocatorError(
      `Path is neither file nor directory: ${locator}`
    );
  },

  async getReader(_locator: string, itemKey: string): Promise<ConnectorReader> {
    const st = await stat(itemKey);
    return new FileConnectorReader(itemKey, st.size);
  },
};
