import pino from "pino";
import type { LogLevel } from "#observability/types/logger.js";
import type { ObservabilityConfiguration } from "#observability/types/observability-configuration.js";
import type { ObservabilityRuntime } from "#observability/runtime-objects/observability/definition.js";
import { PinoObservabilityRuntime } from "#observability/runtime-objects/observability/definition.js";

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

  return new PinoObservabilityRuntime(root);
};
