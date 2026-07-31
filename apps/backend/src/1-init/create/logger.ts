import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { BackendConfig } from "#utils/config/loadBackendConfig.js";
import { FileLogger, NoopLogger } from "#platform/observability/logger.js";
import type { Logger, LogEntry } from "#platform/observability/logger.js";
import type { LogLevel } from "#platform/observability/logger.js";

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

  // Keep one sync append-write per entry. For a future high-throughput version
  // this can be swapped for a buffered write-stream without touching the Logger
  // interface or any call site.
  const writeEntry = (entry: LogEntry): void => {
    const line = JSON.stringify(entry) + "\n";
    const path = join(dir, dailyFileName());
    appendFileSync(path, line, "utf-8");
  };

  return new FileLogger(dir, config.logging.level as LogLevel, writeEntry);
};
