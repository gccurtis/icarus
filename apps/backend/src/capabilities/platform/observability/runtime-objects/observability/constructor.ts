import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pino from "pino";
import type { LogLevel } from "#observability/types/logger.js";
import type {
  ClosableLogStream,
  LogDestination
} from "#observability/types/log-destination.js";
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
 * Reads the destination, validating only the keys the chosen kind uses.
 *
 * The unused key is deliberately not rejected. This is configuration a person
 * edits, not untrusted input: leaving a `directory` in place while running
 * piped is how someone switches back tomorrow, and failing startup over it would
 * punish the ordinary case.
 */
const requiredLogDestination = (
  configuration: ObservabilityConfiguration
): LogDestination => {
  const kind = configuration.get("logging.destination.kind");

  if (kind === "piped") {
    const stream = configuration.get("logging.destination.stream");
    if (stream !== "stdout" && stream !== "stderr") {
      throw new Error(
        "Configuration key 'logging.destination.stream' must be stdout or stderr"
      );
    }
    return { kind: "piped", stream };
  }

  if (kind === "file") {
    const directory = configuration.get("logging.destination.directory");
    if (typeof directory !== "string" || directory.length === 0) {
      throw new Error(
        "Configuration key 'logging.destination.directory' must be a non-empty string"
      );
    }
    return { kind: "file", directory };
  }

  throw new Error("Configuration key 'logging.destination.kind' must be piped or file");
};

/**
 * The name a run's log file takes: `backend-<ISO timestamp>.log`, with the
 * characters a filesystem dislikes replaced.
 *
 * It is a constant of this capability rather than a configuration key, so that
 * every deployment's files are named the same way and a tool that reads them
 * needs no per-environment knowledge. Millisecond precision is kept because two
 * runtimes can start within the same second — a test suite does it routinely —
 * and the two must not write to one file. Because the timestamp is ISO and
 * fixed-width, lexicographic order is chronological order.
 */
const logFileName = (startedAt: Date): string =>
  `backend-${startedAt.toISOString().replace(/[:.]/g, "-")}.log`;

/** Resolves a configured directory against the backend package directory. */
const packageRelative = (directory: string): string =>
  join(dirname(fileURLToPath(import.meta.resolve("#package.json"))), directory);

/**
 * Opens the stream for a destination.
 *
 * A file destination returns the stream as well, because the runtime that opened
 * it is the one that has to close it. A piped destination returns none: file
 * descriptors 1 and 2 belong to the process, not to this runtime.
 */
const openDestination = (
  destination: LogDestination
): { stream: pino.DestinationStream; closable?: ClosableLogStream } => {
  if (destination.kind === "piped") {
    return {
      stream: pino.destination({
        dest: destination.stream === "stderr" ? 2 : 1,
        sync: false
      })
    };
  }

  const file = join(packageRelative(destination.directory), logFileName(new Date()));
  // `mkdir` creates the directory when it is absent, so a fresh checkout needs
  // no setup step before the first run that writes to one.
  const stream = pino.destination({ dest: file, sync: false, mkdir: true });
  return { stream, closable: stream };
};

/**
 * Creates the runtime-scoped observability singleton.
 *
 * Pino writes structured JSON to the configured destination. OpenTelemetry will
 * be added here only when an exporter and instrumentation scope have been
 * chosen; its configuration will join `logging` in
 * [`observability.yaml`](../../../../../configuration/observability.yaml).
 */
export const createObservabilityRuntime = (
  configuration: ObservabilityConfiguration
): ObservabilityRuntime => {
  const enabled = requiredBoolean(configuration, "logging.enabled");
  const level = enabled ? requiredLogLevel(configuration) : "silent";

  // A disabled runtime opens nothing. Creating a log file for a logger that will
  // never write to it would leave an empty file per run as the only evidence
  // that logging is off.
  if (!enabled) {
    return new PinoObservabilityRuntime(pino({ enabled, level, base: { service: "icarus-backend" } }));
  }

  const { stream, closable } = openDestination(requiredLogDestination(configuration));
  const root = pino({ enabled, level, base: { service: "icarus-backend" } }, stream);

  return new PinoObservabilityRuntime(root, closable);
};
