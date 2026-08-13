import type { Logger as PinoLoggerInstance } from "pino";

export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * The application-owned logging port. Callers depend on this small interface,
 * not Pino, so instrumentation stays explicit at capability boundaries.
 */
export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

/** Maps the application logging port to the runtime's one root Pino logger. */
export class PinoLogger implements Logger {
  constructor(private readonly root: PinoLoggerInstance) {}

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
