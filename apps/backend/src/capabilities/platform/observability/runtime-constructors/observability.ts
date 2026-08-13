import pino from "pino";
import { PinoLogger } from "#capabilities/platform/observability/logger.js";
import type { LogLevel } from "#capabilities/platform/observability/logger.js";
import type { ObservabilityRuntime } from "#capabilities/platform/observability/runtime.js";

/** The only configuration surface Observability needs from its caller. */
export interface ObservabilityConfiguration {
  get(key: string): unknown;
}

const requiredBoolean = (
  configuration: ObservabilityConfiguration,
  key: string
): boolean => {
  const value = configuration.get(key);
  if (typeof value !== "boolean") {
    throw new Error(`Configuration key '${key}' must be a boolean`);
  }
  return value;
};

const requiredLogLevel = (configuration: ObservabilityConfiguration): LogLevel => {
  const value = configuration.get("logging.level");
  if (value !== "debug" && value !== "info" && value !== "warn" && value !== "error") {
    throw new Error("Configuration key 'logging.level' must be debug, info, warn, or error");
  }
  return value;
};

const flush = (logger: pino.Logger): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    logger.flush((error?: Error): void => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

/**
 * Creates the runtime-scoped observability singleton.
 *
 * Pino writes structured JSON to stdout, where the deployment environment owns
 * collection and retention. OpenTelemetry will be added here only when an
 * exporter and instrumentation scope have been chosen.
 */
export const createObservabilityRuntime = (
  configuration: ObservabilityConfiguration
): ObservabilityRuntime => {
  const enabled = requiredBoolean(configuration, "logging.enabled");
  const level = enabled ? requiredLogLevel(configuration) : "silent";
  const root = pino({
    enabled,
    level,
    base: { service: "icarus-backend" }
  });

  return {
    logger: new PinoLogger(root),
    close: async (): Promise<void> => flush(root)
  };
};
