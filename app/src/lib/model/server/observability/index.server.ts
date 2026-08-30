/**
 * The entry for Observability.
 *
 * The composition root takes the constructor and the `Observability` type;
 * everything else takes `Logger` and `errorFields`, which are what a capability
 * needs to record what it did and what went wrong.
 */
export { createObservability } from "$model/server/observability/constructor";
export { errorFields } from "$model/server/observability/types";
export type {
  ClosableLogStream,
  LogDestination,
  LogLevel,
  Logger,
  Observability
} from "$model/server/observability/types";
