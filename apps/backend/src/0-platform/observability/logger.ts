export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

/**
 * What kind of thing a record's `data` carries.
 *
 * - `shape` — counts, enums, IDs, durations. Safe everywhere.
 * - `content` — names, titles, prompt text, field values, rows. The fastest way
 *   to see what actually happened, and not something a production build should
 *   be writing to disk by default.
 *
 * Labelling the record rather than loosening the rule is the point: the switch
 * from development to production becomes one configuration value instead of an
 * audit of every call site, and there is still something left to tighten.
 */
export type LogDetail = "shape" | "content";

export interface LogOptions {
  /** Defaults to `shape`, so an unlabelled record is always safe to write. */
  detail?: LogDetail;
}

/** Everything a log entry carries. Structured so it can be parsed back. */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
  /** Absent means `shape`. Written so a reader can filter after the fact. */
  detail?: LogDetail;
}

/**
 * The Logger interface is the only thing the rest of the codebase depends on.
 * Callers never branch on whether logging is enabled; they always call a method
 * and the implementation decides whether to do anything with it.
 */
export interface Logger {
  debug(message: string, data?: unknown, options?: LogOptions): void;
  info(message: string, data?: unknown, options?: LogOptions): void;
  warn(message: string, data?: unknown, options?: LogOptions): void;
  error(message: string, data?: unknown, options?: LogOptions): void;
  /**
   * Flush and release any buffered writes. Optional because most Logger
   * implementations (NoopLogger, test doubles) hold nothing to flush.
   * Shutdown calls this on whatever Logger was constructed.
   */
  close?(): Promise<void>;
}

/** Returned when logging is disabled. Every method is a no-op. */
export class NoopLogger implements Logger {
  debug(_message: string, _data?: unknown, _options?: LogOptions): void {}
  info(_message: string, _data?: unknown, _options?: LogOptions): void {}
  warn(_message: string, _data?: unknown, _options?: LogOptions): void {}
  error(_message: string, _data?: unknown, _options?: LogOptions): void {}
}

/**
 * Writes JSON-line entries to a daily log file in the configured directory.
 * One line per entry: {"timestamp":"…","level":"info","message":"…","data":{…}}
 *
 * Writes are buffered by the caller-supplied `writeEntry`/`closeWriter` pair
 * rather than one blocking write per entry — see 1-init/create/logger.ts.
 */
export class FileLogger implements Logger {
  private readonly minLevel: number;

  constructor(
    private readonly directory: string,
    private readonly level: LogLevel,
    private readonly writeEntry: (entry: LogEntry) => void,
    private readonly closeWriter?: () => Promise<void>,
    /**
     * Which detail labels are written. `content` means everything; `shape`
     * drops content-labelled records entirely rather than redacting their
     * fields, because a half-redacted record is worse than an absent one — it
     * looks complete.
     */
    private readonly detail: LogDetail = "content"
  ) {
    this.minLevel = LOG_LEVEL_RANK[level];
  }

  async close(): Promise<void> {
    await this.closeWriter?.();
  }

  debug(message: string, data?: unknown, options?: LogOptions): void {
    this.log("debug", message, data, options);
  }

  info(message: string, data?: unknown, options?: LogOptions): void {
    this.log("info", message, data, options);
  }

  warn(message: string, data?: unknown, options?: LogOptions): void {
    this.log("warn", message, data, options);
  }

  error(message: string, data?: unknown, options?: LogOptions): void {
    this.log("error", message, data, options);
  }

  private log(
    level: LogLevel,
    message: string,
    data?: unknown,
    options?: LogOptions
  ): void {
    if (LOG_LEVEL_RANK[level] < this.minLevel) {
      return;
    }
    // Unlabelled defaults to `shape`, so every existing call site stays safe
    // without being touched.
    const detail = options?.detail ?? "shape";
    if (detail === "content" && this.detail !== "content") {
      return;
    }

    this.writeEntry({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(data !== undefined ? { data } : {}),
      // Written out so a reader can filter after the fact — the label is part of
      // the record, not only a decision made at write time.
      ...(detail === "content" ? { detail } : {})
    });
  }
}
