/**
 * Reduces an unknown thrown value to fields safe to include in a log record.
 *
 * It sits in Observability because reducing a fault to log fields is a logging
 * concern: it was in Web Server while HTTP was the only thing recording faults,
 * which made every other capability's instrumentation depend on the transport.
 */
export const errorFields = (error: unknown): Record<string, unknown> =>
  error instanceof Error
    ? { errorName: error.name, errorMessage: error.message }
    : { errorName: "UnknownError", errorMessage: String(error) };
