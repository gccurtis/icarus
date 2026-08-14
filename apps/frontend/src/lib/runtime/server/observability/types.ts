export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * The application-owned logging port.
 *
 * Callers depend on this small interface rather than on Pino, so swapping the
 * backend is one file and so instrumentation stays explicit at capability
 * boundaries instead of arriving through a library's ambient global.
 */
export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

/**
 * Where the root logger writes.
 *
 * The two cases differ in what this process is responsible for, not merely in
 * which file descriptor is used. Piped means the process retains nothing and
 * whatever runs it owns collection; file means this process owns creating the
 * file and closing it at shutdown. A single `directory` key with an "empty means
 * stdout" convention would have hidden that difference inside a sentinel.
 */
export type LogDestination =
  | { readonly kind: "piped"; readonly stream: "stdout" | "stderr" }
  | { readonly kind: "file"; readonly directory: string };

/**
 * A log stream this runtime opened and must therefore close.
 *
 * Declared structurally rather than as Pino's stream type, which keeps the
 * library out of `types.ts` and lets a test pass an object literal.
 *
 * Only a file destination produces one. A piped destination must never be
 * closed — ending file descriptor 1 or 2 would take the stream out from under
 * everything else in the process that writes to it.
 */
export interface ClosableLogStream {
  end(): void;
  once(event: "close", listener: () => void): unknown;
  once(event: "error", listener: (error: Error) => void): unknown;
}

/**
 * Reduces an unknown thrown value to fields safe to put in a log record.
 *
 * It lives with logging because reducing a fault to log fields is a logging
 * concern. In the backend it sat in the web server, which made every
 * capability's instrumentation depend on the transport.
 */
export const errorFields = (error: unknown): Record<string, unknown> =>
  error instanceof Error
    ? { errorName: error.name, errorMessage: error.message }
    : { errorName: "UnknownError", errorMessage: String(error) };
