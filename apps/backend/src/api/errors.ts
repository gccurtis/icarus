/**
 * Transport-safe error mapping.
 *
 * Nothing here decides business outcomes. It turns arbitrary thrown values into
 * a shape that is safe to log and safe to return across the transport boundary,
 * so an unexpected error cannot leak an internal payload.
 *
 * Successful status codes and bodies are always chosen by the capability
 * procedure that produced them, never here.
 */

/**
 * Reduces an unknown thrown value to log-safe fields.
 *
 * Only the error's name and message survive. A non-Error value is stringified
 * rather than spread, so a thrown object cannot contribute arbitrary keys to a
 * log record.
 */
export const errorFields = (error: unknown): Record<string, unknown> =>
  error instanceof Error
    ? { errorName: error.name, errorMessage: error.message }
    : { errorName: "UnknownError", errorMessage: String(error) };
