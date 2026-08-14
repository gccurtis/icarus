import type { Logger as PinoRootLogger } from "pino";
import type { ClosableLogStream, LogLevel, Logger } from "$runtime/server/observability/types";

/** The one observability owner for one process. Created at startup, closed at shutdown. */
export interface Observability {
  readonly logger: Logger;
  close(): Promise<void>;
}

/** Maps the application logging port onto one root Pino logger. */
export class PinoLogger implements Logger {
  constructor(private readonly root: PinoRootLogger) {}

  debug(message: string, data?: unknown): void {
    this.write("debug", message, data);
  }

  info(message: string, data?: unknown): void {
    this.write("info", message, data);
  }

  warn(message: string, data?: unknown): void {
    this.write("warn", message, data);
  }

  error(message: string, data?: unknown): void {
    this.write("error", message, data);
  }

  private write(level: LogLevel, message: string, data?: unknown): void {
    if (data === undefined) {
      this.root[level](message);
      return;
    }

    // Arbitrary application data goes in one predictable field. Pino owns the
    // envelope — time, level, message, bindings — and serializes it safely,
    // including the cycles and getters an application value might carry.
    this.root[level]({ data }, message);
  }
}

/**
 * Flushes the root logger and resolves once the write has been accepted.
 *
 * Pino buffers, so a process that exits without this loses the last records it
 * wrote — including, usually, the failure that caused the exit.
 */
const flush = (root: PinoRootLogger): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    root.flush((error?: Error): void => {
      if (error) reject(error);
      else resolve();
    });
  });

/** Ends a stream this runtime opened, resolving once the file is closed. */
const endStream = (stream: ClosableLogStream): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    stream.once("error", reject);
    stream.once("close", resolve);
    stream.end();
  });

/** The Pino-backed runtime: one root logger, one port over it. */
export class PinoObservability implements Observability {
  readonly logger: Logger;

  /**
   * `stream` is present only when this runtime opened a file. A piped
   * destination passes none, which is what stops shutdown from closing a file
   * descriptor this process did not open.
   */
  constructor(
    private readonly root: PinoRootLogger,
    private readonly stream?: ClosableLogStream
  ) {
    this.logger = new PinoLogger(root);
  }

  /**
   * Flush, then close the file if this runtime opened one.
   *
   * The order matters: ending a stream before flushing drops records Pino has
   * accepted but not yet written.
   */
  async close(): Promise<void> {
    await flush(this.root);
    if (this.stream) await endStream(this.stream);
  }
}
