/**
 * The centralized logger.
 *
 * One place every part of Taurus Alpha reports through — app code, and the e2e
 * harness alongside it — so that "what happened, in what order" is answerable
 * from a single stream instead of reconstructed from scattered `console.log`s.
 *
 * It is deliberately transport-free. A log event is a plain, serializable
 * record; where those records GO is a sink, and sinks are registered at the
 * edges. Today there are two (a console sink for humans, a ring buffer for
 * machines). A production sink that ships events to a collector is the same
 * `addSink` call and needs no change here or at any call site — which is the
 * point of centralizing now rather than after the call sites multiply.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** One structured record. Serializable by construction, so any sink can ship it. */
export type LogEvent = {
  /** Epoch millis. */
  at: number;
  level: LogLevel;
  /** Dotted subsystem name, e.g. `documents.sync` or `e2e.session-expiry`. */
  scope: string;
  message: string;
  /** Structured detail. Prefer fields over interpolating values into `message`. */
  data?: Record<string, unknown>;
};

export type LogSink = (event: LogEvent) => void;

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * The ring buffer's cap. Bounded because this runs in a long-lived browser tab:
 * an unbounded log is a memory leak that only shows up in the sessions that
 * matter most (the long ones).
 */
const BUFFER_LIMIT = 500;

let minLevel: LogLevel = 'info';
let buffer: LogEvent[] = [];
const sinks = new Set<LogSink>();

/** Records every event, oldest dropped first. Always on — it is the diagnostic tail. */
function bufferSink(event: LogEvent): void {
  buffer.push(event);
  if (buffer.length > BUFFER_LIMIT) buffer.splice(0, buffer.length - BUFFER_LIMIT);
}

/**
 * Human-readable output. Routed per level so browser devtools filtering and
 * stack capture work normally; `warn`/`error` must not be flattened into `log`
 * or they stop being visible where people actually look for them.
 */
function consoleSink(event: LogEvent): void {
  const stamp = new Date(event.at).toISOString().slice(11, 23);
  const line = `${stamp} ${event.level.toUpperCase().padEnd(5)} [${event.scope}] ${event.message}`;
  const method = event.level === 'debug' ? 'log' : event.level;
  if (event.data) console[method](line, event.data);
  else console[method](line);
}

sinks.add(bufferSink);
sinks.add(consoleSink);

function emit(level: LogLevel, scope: string, message: string, data?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
  const event: LogEvent = { at: Date.now(), level, scope, message, ...(data ? { data } : {}) };
  for (const sink of sinks) {
    try {
      sink(event);
    } catch {
      // A broken sink must never break the code that logged. Swallow it here
      // rather than let a telemetry failure become a product failure.
    }
  }
}

export type Logger = {
  debug: (message: string, data?: Record<string, unknown>) => void;
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
  /** Derive a nested scope: `createLogger('documents').child('sync')` → `documents.sync`. */
  child: (suffix: string) => Logger;
};

/** A logger bound to one subsystem. Scopes are how a stream stays readable. */
export function createLogger(scope: string): Logger {
  return {
    debug: (message, data) => emit('debug', scope, message, data),
    info: (message, data) => emit('info', scope, message, data),
    warn: (message, data) => emit('warn', scope, message, data),
    error: (message, data) => emit('error', scope, message, data),
    child: (suffix) => createLogger(`${scope}.${suffix}`)
  };
}

/** Events below this are dropped at the source. Default `info`. */
export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

export function getLogLevel(): LogLevel {
  return minLevel;
}

/**
 * The retained tail, oldest first. This is what a diagnostic reads — the e2e
 * harness pulls it out of the page after a failure, and a future "copy
 * diagnostics" affordance would use the same call.
 */
export function getLogBuffer(): LogEvent[] {
  return [...buffer];
}

export function clearLogBuffer(): void {
  buffer = [];
}

/** Register an additional destination. Returns its remover. */
export function addSink(sink: LogSink): () => void {
  sinks.add(sink);
  return () => void sinks.delete(sink);
}

/** Drop the console sink — for tests that assert on the buffer without noise. */
export function removeConsoleSink(): void {
  sinks.delete(consoleSink);
}

/**
 * Expose the buffer to the page so a driving harness can read it.
 *
 * `page.evaluate` runs in the page's own realm and cannot import app modules, so
 * a diagnostic that wants the app's view of events needs a handle hung somewhere
 * reachable. **Dev builds only** — a production bundle must not carry a global
 * that hands out an internal event stream.
 */
if (import.meta.env?.DEV && typeof window !== 'undefined') {
  (window as unknown as { __taurusLog?: unknown }).__taurusLog = {
    getBuffer: getLogBuffer,
    clear: clearLogBuffer,
    setLevel: setLogLevel
  };
}
