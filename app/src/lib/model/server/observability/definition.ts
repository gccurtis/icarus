import type { Logger as PinoRootLogger } from "pino";
import type {
  ClosableLogStream,
  LogLevel,
  Logger,
  Observability
} from "$model/server/observability/types";
import { close } from "$model/server/observability/methods/close";

/**
 * What one instance holds: the root logger every record goes through, and the
 * stream only if this object opened one.
 *
 * The absent stream is the whole of the piped case. A flag beside a descriptor
 * would let shutdown reach a stream it did not open; there is nothing to reach.
 */
export interface ObservabilityState {
  readonly root: PinoRootLogger;
  readonly stream?: ClosableLogStream;
}

/** Maps the application logging port onto one root Pino logger. */
export class PinoLogger implements Logger {
  readonly #root: PinoRootLogger;

  constructor(root: PinoRootLogger) {
    this.#root = root;
  }

  debug(message: string, data?: unknown): void {
    this.#write("debug", message, data);
  }

  info(message: string, data?: unknown): void {
    this.#write("info", message, data);
  }

  warn(message: string, data?: unknown): void {
    this.#write("warn", message, data);
  }

  error(message: string, data?: unknown): void {
    this.#write("error", message, data);
  }

  #write(level: LogLevel, message: string, data?: unknown): void {
    if (data === undefined) {
      this.#root[level](message);
      return;
    }

    // Arbitrary application data goes in one predictable field. Pino owns the
    // envelope — time, level, message, bindings — and serializes it safely,
    // including the cycles and getters an application value might carry.
    this.#root[level]({ data }, message);
  }
}

/** The Pino-backed observability object: one root logger, one port over it. */
export class PinoObservability implements Observability {
  readonly logger: Logger;
  readonly #state: ObservabilityState;

  /**
   * `stream` is present only when this object opened a file. A piped destination
   * passes none, which is what stops shutdown from closing a file descriptor
   * this process did not open.
   */
  constructor(root: PinoRootLogger, stream?: ClosableLogStream) {
    this.#state = { root, stream };
    this.logger = new PinoLogger(root);
  }

  close(): Promise<void> {
    return close(this.#state);
  }
}
