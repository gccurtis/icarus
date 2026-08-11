import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  createLogger,
  getLogBuffer,
  clearLogBuffer,
  setLogLevel,
  getLogLevel,
  addSink,
  type LogEvent
} from './logger';

// The logger is the one place every subsystem reports through, so its contract
// has to hold under the boring cases (levels, scopes) AND the ugly one: a sink
// that throws must never take down the code that logged.

beforeEach(() => {
  clearLogBuffer();
  setLogLevel('debug');
});

afterEach(() => {
  vi.restoreAllMocks();
  setLogLevel('info');
});

describe('createLogger', () => {
  it('records level, scope, message, and structured data', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    createLogger('documents.sync').info('flushed', { ops: 3 });
    const [event] = getLogBuffer();
    expect(event.level).toBe('info');
    expect(event.scope).toBe('documents.sync');
    expect(event.message).toBe('flushed');
    expect(event.data).toEqual({ ops: 3 });
    expect(typeof event.at).toBe('number');
  });

  it('omits the data key entirely when none is passed', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    createLogger('a').info('bare');
    expect('data' in getLogBuffer()[0]).toBe(false);
  });

  it('nests scopes through child()', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    createLogger('editor').child('selection').warn('lost');
    expect(getLogBuffer()[0].scope).toBe('editor.selection');
  });

  it('routes each level at its own console method', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = createLogger('x');
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    // debug goes to console.log — devtools treat `debug` as hidden by default.
    expect(log).toHaveBeenCalledOnce();
    expect(info).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
  });
});

describe('level filtering', () => {
  it('drops events below the minimum at the source', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    setLogLevel('warn');
    const logger = createLogger('x');
    logger.debug('no');
    logger.info('no');
    logger.warn('yes');
    expect(getLogBuffer().map((e) => e.message)).toEqual(['yes']);
    expect(getLogLevel()).toBe('warn');
  });
});

describe('sinks', () => {
  it('delivers to an added sink and stops after it is removed', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const seen: LogEvent[] = [];
    const remove = addSink((e) => seen.push(e));
    createLogger('x').info('first');
    remove();
    createLogger('x').info('second');
    expect(seen.map((e) => e.message)).toEqual(['first']);
  });

  it('keeps working when a sink throws — telemetry must not break the caller', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const remove = addSink(() => {
      throw new Error('sink is broken');
    });
    expect(() => createLogger('x').info('still logged')).not.toThrow();
    // The buffer sink still received it despite the broken neighbour.
    expect(getLogBuffer()[0].message).toBe('still logged');
    remove();
  });
});

describe('the ring buffer', () => {
  it('is bounded, keeping the newest events', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = createLogger('x');
    for (let index = 0; index < 520; index += 1) logger.info(`event-${index}`);
    const events = getLogBuffer();
    expect(events).toHaveLength(500);
    expect(events[0].message).toBe('event-20');
    expect(events.at(-1)!.message).toBe('event-519');
  });

  it('returns a copy, so a reader cannot mutate the tail', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    createLogger('x').info('one');
    getLogBuffer().push({ at: 0, level: 'error', scope: 'fake', message: 'injected' });
    expect(getLogBuffer()).toHaveLength(1);
  });
});
