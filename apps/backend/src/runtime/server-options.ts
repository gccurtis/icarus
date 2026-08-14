import type { Configuration } from "#configuration";
import type { ListenAddress, WebServerOptions } from "#web-server";

/**
 * Narrows the configuration keys the web server needs.
 *
 * Configuration hands back `unknown`, because a YAML file can hold anything, and
 * the capability deliberately provides no defaults and no coercion. Narrowing
 * happens here, at the composition root that supplies the values, rather than
 * inside the configuration capability — which would then have to know what every
 * consumer's keys mean.
 *
 * Every key is required. A missing bound is not defaulted quietly: a server
 * running with a limit nobody chose is the state these keys exist to end.
 */
export const requiredListenAddress = (configuration: Configuration): ListenAddress => ({
  host: requiredHost(configuration),
  port: requiredPort(configuration)
});

export const requiredWebServerOptions = (configuration: Configuration): WebServerOptions => ({
  bodyLimitBytes: requiredPositiveInteger(configuration, "server.bodyLimitBytes"),
  requestTimeoutMs: requiredPositiveInteger(configuration, "server.requestTimeoutMs")
});

function requiredHost(configuration: Configuration): string {
  const value = configuration.get("server.host");
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Configuration key 'server.host' must be a non-empty string");
  }
  return value;
}

function requiredPort(configuration: Configuration): number {
  const value = configuration.get("server.port");
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 65_535
  ) {
    throw new Error("Configuration key 'server.port' must be an integer from 0 to 65535");
  }
  return value;
}

function requiredPositiveInteger(configuration: Configuration, key: string): number {
  const value = configuration.get(key);
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Configuration key '${key}' must be a positive integer`);
  }
  return value;
}
