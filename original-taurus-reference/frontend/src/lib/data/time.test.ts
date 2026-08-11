import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  relativeTime,
  documentEditStamp,
  documentEditRelative,
  activityStamp
} from './time';

describe('relativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-24T12:00:00Z'));
  });

  it('returns "just now" for timestamps within the last 30 seconds', () => {
    const ts = new Date('2026-07-24T11:59:45Z').getTime();
    expect(relativeTime(ts)).toBe('just now');
  });

  it('returns minutes ago', () => {
    const ts = new Date('2026-07-24T11:55:00Z').getTime();
    expect(relativeTime(ts)).toBe('5m ago');
  });

  it('returns hours ago', () => {
    const ts = new Date('2026-07-24T09:00:00Z').getTime();
    expect(relativeTime(ts)).toBe('3h ago');
  });

  it('returns days ago', () => {
    const ts = new Date('2026-07-22T12:00:00Z').getTime();
    expect(relativeTime(ts)).toBe('2d ago');
  });

  it('returns weeks ago', () => {
    const ts = new Date('2026-07-10T12:00:00Z').getTime();
    expect(relativeTime(ts)).toBe('2w ago');
  });

  it('falls back to date string for timestamps older than 5 weeks', () => {
    const ts = new Date('2026-05-01T12:00:00Z').getTime();
    const result = relativeTime(ts);
    expect(result).not.toBe('just now');
    expect(result).not.toContain('m ago');
    expect(result).not.toContain('h ago');
    expect(result).not.toContain('d ago');
    expect(result).not.toContain('w ago');
  });
});

describe('documentEditStamp', () => {
  it('formats a timestamp as a complete date string', () => {
    const ts = Date.UTC(2026, 6, 24, 15, 14, 0);
    const result = documentEditStamp(ts);
    expect(result).toContain('2026');
    expect(result).toContain('Jul');
    expect(result).toContain('24');
  });

  it('returns "unknown time" for zero', () => {
    expect(documentEditStamp(0)).toBe('unknown time');
  });

  it('returns "unknown time" for negative values', () => {
    expect(documentEditStamp(-1)).toBe('unknown time');
  });

  it('returns "unknown time" for NaN', () => {
    expect(documentEditStamp(NaN)).toBe('unknown time');
  });

  it('returns "unknown time" for Infinity', () => {
    expect(documentEditStamp(Infinity)).toBe('unknown time');
  });
});

describe('documentEditRelative', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-24T12:00:00Z'));
  });

  it('returns "just now" for timestamps within the last minute', () => {
    const ts = new Date('2026-07-24T11:59:45Z').getTime();
    expect(documentEditRelative(ts)).toBe('just now');
  });

  it('returns relative minutes', () => {
    const ts = new Date('2026-07-24T11:50:00Z').getTime();
    const result = documentEditRelative(ts);
    expect(result).toContain('minute');
  });

  it('returns relative hours', () => {
    const ts = new Date('2026-07-24T08:00:00Z').getTime();
    const result = documentEditRelative(ts);
    expect(result).toContain('hour');
  });

  it('returns relative days', () => {
    const ts = new Date('2026-07-20T12:00:00Z').getTime();
    const result = documentEditRelative(ts);
    expect(result).toContain('day');
  });

  it('accepts an explicit now parameter', () => {
    const ts = Date.UTC(2026, 6, 24, 11, 30, 0);
    const now = Date.UTC(2026, 6, 24, 12, 0, 0);
    expect(documentEditRelative(ts, now)).toContain('minute');
  });

  it('returns "at an unknown time" for zero', () => {
    expect(documentEditRelative(0)).toBe('at an unknown time');
  });

  it('returns "at an unknown time" for negative', () => {
    expect(documentEditRelative(-1)).toBe('at an unknown time');
  });

  it('returns "at an unknown time" for NaN', () => {
    expect(documentEditRelative(NaN)).toBe('at an unknown time');
  });

  it('handles future timestamps', () => {
    const future = new Date('2026-07-25T12:00:00Z').getTime();
    const result = documentEditRelative(future);
    expect(result).toContain('day');
  });
});

describe('activityStamp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-24T12:00:00Z'));
  });

  it('returns "Today" for timestamps today', () => {
    const ts = new Date('2026-07-24T09:30:00Z').getTime();
    expect(activityStamp(ts)).toContain('Today');
  });

  it('returns "Yesterday" for timestamps one day ago', () => {
    const ts = new Date('2026-07-23T14:00:00Z').getTime();
    expect(activityStamp(ts)).toContain('Yesterday');
  });

  it('returns weekday for timestamps within the last week', () => {
    const ts = new Date('2026-07-20T12:00:00Z').getTime();
    expect(activityStamp(ts)).toContain('Mon');
  });

  it('returns month+day for older timestamps', () => {
    const ts = new Date('2026-06-01T12:00:00Z').getTime();
    expect(activityStamp(ts)).toContain('Jun');
    expect(activityStamp(ts)).toContain('1');
  });

  it('includes the time of day', () => {
    const ts = new Date('2026-07-24T14:30:00Z').getTime();
    expect(activityStamp(ts)).toContain(':');
    expect(activityStamp(ts)).toContain('·');
  });
});
