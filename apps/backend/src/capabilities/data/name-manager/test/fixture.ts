import type { Logger } from "#observability";

/**
 * A logger that records nothing.
 *
 * These tests assert catalog behavior, not instrumentation, and a real logger
 * would put a line on stdout for every call the suite makes. Instrumentation is
 * covered where it is written, in the runtime object's own tests.
 */
export const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
};
