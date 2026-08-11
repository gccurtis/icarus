import { describe, it, expect } from 'vitest';
import { groupEventsByDay } from './activity-timeline';
import type { ActivityEvent } from '$data/projects';

const at = (iso: string) => Date.parse(iso);
const NOW = at('2026-07-29T18:00:00');

const event = (id: string, occurredAt: number): ActivityEvent => ({
  id,
  actor: { id: 'u1', name: 'Ada' },
  action: 'edited',
  target: { id: `r_${id}`, name: 'Doc', kind: 'document' },
  occurredAt
});

describe('groupEventsByDay', () => {
  it('groups a newest-first list into newest-first days', () => {
    const days = groupEventsByDay(
      [
        event('a', at('2026-07-29T17:00:00')),
        event('b', at('2026-07-29T09:00:00')),
        event('c', at('2026-07-28T22:00:00')),
        // Inside the last week, so it reads as a weekday; older than that falls
        // back to a date.
        event('d', at('2026-07-24T10:00:00')),
        event('e', at('2026-07-12T10:00:00'))
      ],
      NOW
    );
    expect(days.map((d) => d.label)).toEqual(['Today', 'Yesterday', 'Fri', 'Jul 12']);
    expect(days[0].events.map((e) => e.id)).toEqual(['a', 'b']);
    expect(days[1].events.map((e) => e.id)).toEqual(['c']);
  });

  it('keeps a day together when its events arrive in separate pages', () => {
    // The real case this exists for: paging splits a day, and the second page's
    // events must land in the SAME group as the first page's.
    const firstPage = [event('a', at('2026-07-29T17:00:00'))];
    const secondPage = [event('b', at('2026-07-29T02:00:00'))];
    const days = groupEventsByDay([...firstPage, ...secondPage], NOW);
    expect(days).toHaveLength(1);
    expect(days[0].events.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('splits on the local calendar day, not on a 24-hour window', () => {
    // 23:30 yesterday and 00:30 today are 60 minutes apart and belong to
    // different days.
    const days = groupEventsByDay(
      [event('a', at('2026-07-29T00:30:00')), event('b', at('2026-07-28T23:30:00'))],
      NOW
    );
    expect(days.map((d) => d.label)).toEqual(['Today', 'Yesterday']);
  });

  it('does not merge two days that share a label', () => {
    // A week apart, both "Thu" by weekday name — keyed by date, so they stay apart.
    const days = groupEventsByDay(
      [event('a', at('2026-07-23T10:00:00')), event('b', at('2026-07-16T10:00:00'))],
      NOW
    );
    expect(days).toHaveLength(2);
    expect(days[0].key).not.toBe(days[1].key);
  });

  it('preserves the order the server sent within a day', () => {
    const days = groupEventsByDay(
      [event('newer', at('2026-07-29T17:00:00')), event('older', at('2026-07-29T08:00:00'))],
      NOW
    );
    expect(days[0].events.map((e) => e.id)).toEqual(['newer', 'older']);
  });

  it('is empty for no events', () => {
    expect(groupEventsByDay([], NOW)).toEqual([]);
  });
});
