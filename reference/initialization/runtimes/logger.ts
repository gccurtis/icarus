import { mkdirSync, createWriteStream } from "node:fs";
import type { WriteStream } from "node:fs";
import { join } from "node:path";
import type { BackendConfig } from "#initialization/configuration.js";
import { FileLogger, NoopLogger } from "#capabilities/observability/logger.js";
import type { Logger, LogEntry } from "#capabilities/observability/logger.js";
import type { LogLevel } from "#capabilities/observability/logger.js";

// Build a daily file name so logs rotate automatically at midnight.
const dailyFileName = (): string => {
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `backend-${date}.log`;
};

export const createLogger = (config: BackendConfig): Logger => {
  // When logging is disabled the caller gets a no-op implementation. Nothing
  // else in the codebase needs to check whether logging is enabled.
  if (!config.logging.enabled) {
    return new NoopLogger();
  }

  const dir = config.logging.directory;

  // Ensure the directory exists before the first write attempt.
  mkdirSync(dir, { recursive: true });

  // One write stream per day, reopened on rollover. A stream buffers writes
  // internally instead of the previous per-entry blocking appendFileSync, so
  // dense logging (e.g. per-attempt lifecycle events) no longer puts a
  // synchronous disk write directly on the request path.
  let currentFileName = "";
  let stream: WriteStream | undefined;

  const streamForToday = (): WriteStream => {
    const fileName = dailyFileName();
    if (fileName !== currentFileName || !stream) {
      stream?.end();
      currentFileName = fileName;
      stream = createWriteStream(join(dir, fileName), { flags: "a", encoding: "utf-8" });
      // A sink failure must not throw into a capability call. The bounded
      // fallback signal is stderr; the domain result is never affected.
      stream.on("error", (error) => {
        process.stderr.write(`logger: write stream error: ${String(error)}\n`);
      });
    }
    return stream;
  };

  const writeEntry = (entry: LogEntry): void => {
    const line = JSON.stringify(entry) + "\n";
    streamForToday().write(line);
  };

  const closeWriter = async (): Promise<void> => {
    if (!stream) return;
    const active = stream;
    stream = undefined;
    await new Promise<void>((resolve) => {
      active.end(() => resolve());
    });
  };

  return new FileLogger(dir, config.logging.level as LogLevel, writeEntry, closeWriter);
};
