// Local filesystem connector provider.
// The ConnectorService calls listItems() and diffs against stored items for sync.
// mtime-based revision tokens enable selective sync (only changed items re-read).

import { stat, readdir, open } from "node:fs/promises";
import { resolve, basename, extname } from "node:path";
import { PROSE_TEXT_EXTENSIONS } from "../domain/model.js";
import type { ConnectorProvider, ConnectorItem } from "../domain/provider.js";
import type { ConnectorReader, ByteRange } from "../domain/reader.js";
import { UnsupportedLocatorError } from "../domain/errors.js";

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
    const fd = await open(this.filePath, "r");
    try {
      const buf = Buffer.alloc(range.end - range.start);
      await fd.read(buf, 0, buf.length, range.start);
      return buf.toString("utf8");
    } finally {
      await fd.close();
    }
  }

  async readAll(): Promise<string> {
    const fd = await open(this.filePath, "r");
    try {
      const st = await fd.stat();
      const buf = Buffer.alloc(st.size);
      await fd.read(buf, 0, st.size, 0);
      return buf.toString("utf8");
    } finally {
      await fd.close();
    }
  }

  async *readStream(chunkSize: number = 65536): AsyncIterable<string> {
    const fd = await open(this.filePath, "r");
    try {
      const st = await fd.stat();
      let offset = 0;
      while (offset < st.size) {
        const buf = Buffer.alloc(Math.min(chunkSize, st.size - offset));
        await fd.read(buf, 0, buf.length, offset);
        offset += buf.length;
        yield buf.toString("utf8");
      }
    } finally {
      await fd.close();
    }
  }

  async readLines(startLine: number, endLine: number): Promise<string[]> {
    const full = await this.readAll();
    const lines = full.split("\n");
    return lines.slice(startLine - 1, endLine);
  }
}

export const filesystemProvider: ConnectorProvider = {
  kind: "filesystem",
  label: "Local Filesystem",

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