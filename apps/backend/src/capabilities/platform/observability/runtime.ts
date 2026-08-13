import type { Logger } from "#capabilities/platform/observability/logger.js";

/**
 * The one observability owner for one backend runtime. It is created by main,
 * passed to its consumers, and closed during runtime shutdown.
 */
export interface ObservabilityRuntime {
  readonly logger: Logger;
  close(): Promise<void>;
}
