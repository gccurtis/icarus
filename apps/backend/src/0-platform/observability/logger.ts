export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

/** Everything a log entry carries. Structured so it can be parsed back. */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

/**
 * The Logger interface is the only thing the rest of the codebase depends on.
 * Callers never branch on whether logging is enabled; they always call a method
 * and the implementation decides whether to do anything with it.
 */
export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

/** Returned when logging is disabled. Every method is a no-op. */
export class NoopLogger implements Logger {
  debug(_message: string, _data?: unknown): void {}
  info(_message: string, _data?: unknown): void {}
  warn(_message: string, _data?: unknown): void {}
  error(_message: string, _data?: unknown): void {}
}

/**
 * Writes JSON-line entries to a daily log file in the configured directory.
 * One line per entry: {"timestamp":"…","level":"info","message":"…","data":{…}}
 */
export class FileLogger implements Logger {
  private readonly minLevel: number;

  constructor(
    private readonly directory: string,
    private readonly level: LogLevel,
    private readonly writeEntry: (entry: LogEntry) => void
  ) {
    this.minLevel = LOG_LEVEL_RANK[level];
  }

  debug(message: string, data?: unknown): void {
    this.log("debug", message, data);
  }

  info(message: string, data?: unknown): void {
    this.log("info", message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log("warn", message, data);
  }

  error(message: string, data?: unknown): void {
    this.log("error", message, data);
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (LOG_LEVEL_RANK[level] < this.minLevel) {
      return;
    }

    this.writeEntry({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(data !== undefined ? { data } : {})
    });
  }
}
