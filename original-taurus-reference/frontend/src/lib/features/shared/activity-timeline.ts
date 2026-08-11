import type { ActivityEvent } from '$data/projects';
import { dayLabel } from '$data/time';

/**
 * How a long activity list is broken into days — the projection behind the
 * context rail's History lens.
 *
 * Separate from the panel, and pure, because the rule it encodes is easy to get
 * wrong in a way nobody notices: the feed arrives newest-first and is paged, so a
 * day's events can be split across two responses. Grouping has to be by calendar
 * day (local midnight), not by "every run of events within 24 hours of each
 * other".
 */

export type ActivityDay = {
  /** A stable key for the day — the local date, not the label. */
  key: string;
  /** "Today" / "Yesterday" / "Thu" / "Jul 24". */
  label: string;
  events: ActivityEvent[];
};

/** The local calendar date of a timestamp, as a stable `YYYY-M-D` key. */
function dayKey(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * Group a newest-first event list into newest-first days.
 *
 * Keyed by local date rather than by the *label*, because two different days can
 * carry the same label text on either side of a week boundary (two "Thu"s), and
 * a label collision would silently merge them into one heading.
 *
 * Input order is preserved within a day — the caller's ordering is the server's,
 * and re-sorting here would hide a paging bug rather than surface it.
 */
export function groupEventsByDay(events: ActivityEvent[], now = Date.now()): ActivityDay[] {
  const days: ActivityDay[] = [];
  const index = new Map<string, ActivityDay>();
  for (const event of events) {
    const key = dayKey(event.occurredAt);
    let day = index.get(key);
    if (!day) {
      day = { key, label: dayLabel(event.occurredAt, now), events: [] };
      index.set(key, day);
      days.push(day);
    }
    day.events.push(event);
  }
  return days;
}
