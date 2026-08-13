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
