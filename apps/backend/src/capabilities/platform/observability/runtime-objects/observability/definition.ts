import type { Logger as PinoRootLogger } from "pino";
import type { LogLevel, Logger } from "#observability/types/logger.js";
import type { ClosableLogStream } from "#observability/types/log-destination.js";
import { closeRootLogger } from "#observability/runtime-api/close/close.js";

/**
 * The one observability owner for one backend runtime. It is created during
 * startup, passed to its consumers, and closed during runtime shutdown.
 */
export interface ObservabilityRuntime {
  readonly logger: Logger;
  close(): Promise<void>;
}

/** Maps the application logging port to the runtime's one root Pino logger. */
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

    // Keep arbitrary application data in one predictable field. Pino owns the
    // envelope (time, level, message, bindings) and serializes it safely.
    this.root[level]({ data }, message);
  }
}

/** The Pino-backed runtime: one root logger, one port over it. */
export class PinoObservabilityRuntime implements ObservabilityRuntime {
  readonly logger: Logger;

  /**
   * `stream` is present only when this runtime opened a file. A piped
   * destination passes none, which is what stops shutdown from closing a file
   * descriptor the process did not open.
   */
  constructor(
    private readonly root: PinoRootLogger,
    private readonly stream?: ClosableLogStream
  ) {
    this.logger = new PinoLogger(root);
  }

  close(): Promise<void> {
    return closeRootLogger(this.root, this.stream);
  }
}
