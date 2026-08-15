import { join } from "node:path";
import pino from "pino";
import type { Configuration } from "$model/server/configuration/index.server";
import type {
  ClosableLogStream,
  LogDestination,
  LogLevel,
  Observability
} from "$model/server/observability/types";
import { PinoObservability } from "$model/server/observability/definition";

const requiredBoolean = (configuration: Configuration, key: string): boolean => {
  const value = configuration.get(key);
  if (typeof value !== "boolean") {
    throw new Error(`Configuration key '${key}' must be a boolean`);
  }
  return value;
};

const requiredLogLevel = (configuration: Configuration): LogLevel => {
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
 * edits, not untrusted input: leaving a `directory` in place while running piped
 * is how someone switches back tomorrow, and failing startup over it would
 * punish the ordinary case to catch a typo that harms nothing.
 */
const requiredLogDestination = (configuration: Configuration): LogDestination => {
  const kind = configuration.get("logging.destination.kind");

  if (kind === "piped") {
    const stream = configuration.get("logging.destination.stream");
    if (stream !== "stdout" && stream !== "stderr") {
      throw new Error("Configuration key 'logging.destination.stream' must be stdout or stderr");
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
 * The name a run's log file takes: `icarus-<ISO timestamp>.log`, with the
 * characters a filesystem dislikes replaced.
 *
 * A constant rather than a configuration key, so every deployment names its
 * files the same way and a tool reading them needs no per-environment
 * knowledge. Millisecond precision is kept because two processes can start
 * inside the same second — a test suite does it routinely — and they must not
 * share a file. The timestamp being ISO and fixed-width makes lexicographic
 * order chronological order.
 */
const logFileName = (startedAt: Date): string =>
  `icarus-${startedAt.toISOString().replace(/[:.]/g, "-")}.log`;

/**
 * Opens the stream for a destination.
 *
 * A file destination returns the stream too, because whoever opened it has to
 * close it. A piped destination returns none: descriptors 1 and 2 belong to the
 * process, not to this object.
 */
const openDestination = (
  destination: LogDestination
): { stream: pino.DestinationStream; closable?: ClosableLogStream } => {
  if (destination.kind === "piped") {
    return {
      stream: pino.destination({ dest: destination.stream === "stderr" ? 2 : 1, sync: false })
    };
  }

  // Resolved against the working directory for the same reason configuration is:
  // this module is bundled, so its own location is a build artifact's location.
  const file = join(process.cwd(), destination.directory, logFileName(new Date()));
  const stream = pino.destination({ dest: file, sync: false, mkdir: true });

  // An async destination opens after this returns, so a permission or disk
  // failure arrives out-of-band. Pino's broken-pipe filter removes itself and
  // re-emits 'error' — and an EventEmitter with no 'error' listener throws,
  // killing the process outside any try. Logging that we cannot log is the
  // best available answer: the destination we would report it to is the thing
  // that failed.
  stream.on("error", (error: Error) => {
    process.exitCode = 1;
    console.error(`log destination '${file}' failed:`, error.message);
  });

  return { stream, closable: stream };
};

/**
 * Creates the process-wide observability object.
 *
 * Structured JSON to the configured destination. OpenTelemetry joins this only
 * when an exporter and an instrumentation scope have been chosen.
 *
 * Every key is read before anything is opened, so a misconfigured destination
 * throws with nothing acquired and nothing to release.
 */
export const createObservability = (configuration: Configuration): Observability => {
  const enabled = requiredBoolean(configuration, "logging.enabled");
  const level = enabled ? requiredLogLevel(configuration) : "silent";
  const base = { service: "icarus" };

  // A disabled object opens nothing. Creating a log file for a logger that will
  // never write to it leaves an empty file per run as the only evidence that
  // logging is off.
  if (!enabled) return new PinoObservability(pino({ enabled, level, base }));

  const { stream, closable } = openDestination(requiredLogDestination(configuration));
  return new PinoObservability(pino({ enabled, level, base }, stream), closable);
};
