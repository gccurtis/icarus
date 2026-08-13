import type { Logger as PinoRootLogger } from "pino";
import type { LogLevel, Logger } from "#observability/types/logger.js";
import { flushRootLogger } from "#observability/runtime-api/close/close.js";

/**
 * The one observability owner for one backend runtime. It is created by main,
 * passed to its consumers, and closed during runtime shutdown.
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

  constructor(private readonly root: PinoRootLogger) {
    this.logger = new PinoLogger(root);
  }

  close(): Promise<void> {
    return flushRootLogger(this.root);
  }
}
