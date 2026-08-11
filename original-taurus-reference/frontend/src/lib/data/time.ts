/**
 * Unified time formatting for every surface in the cockpit.
 *
 * Migrated from four scattered implementations:
 *   resources.ts    — relativeTime    (compact "3h ago")
 *   doc-collab.ts   — documentEditStamp   (full "Jul 23, 2026, 3:14 PM")
 *   doc-collab.ts   — documentEditRelative ("5 minutes ago")
 *   overview.ts     — activityStamp  ("2:14 PM · Today")
 */

/** Compact relative time for resource tables, e.g. "3h ago". */
export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(ts).toLocaleDateString();
}

/** A complete date-and-time label for the document bar. */
export function documentEditStamp(at: number): string {
  if (!Number.isFinite(at) || at <= 0) return 'unknown time';
  return new Date(at).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

/** Human relative time for the quiet center status, e.g. "5 minutes ago". */
export function documentEditRelative(at: number, now = Date.now()): string {
  if (!Number.isFinite(at) || at <= 0) return 'at an unknown time';
  const delta = at - now;
  const absolute = Math.abs(delta);
  if (absolute < 60000) return 'just now';
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'always' });
  if (absolute < 3600000) return formatter.format(Math.round(delta / 60000), 'minute');
  if (absolute < 86400000) return formatter.format(Math.round(delta / 3600000), 'hour');
  if (absolute < 604800000) return formatter.format(Math.round(delta / 86400000), 'day');
  if (absolute < 2592000000) return formatter.format(Math.round(delta / 604800000), 'week');
  if (absolute < 31536000000) return formatter.format(Math.round(delta / 2592000000), 'month');
  return formatter.format(Math.round(delta / 31536000000), 'year');
}

/**
 * Which day a timestamp belongs to, in the reader's terms: "Today",
 * "Yesterday", a weekday inside the last week, else a date.
 *
 * Extracted from `activityStamp` so the History lens's day headings and the
 * activity feed's per-event stamps cannot disagree about where a day starts —
 * both anchor on local midnight, not on a 24-hour offset from now.
 */
export function dayLabel(at: number, now = Date.now()): string {
  const d = new Date(at);
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const day = 86400000;
  if (at >= startOfToday) return 'Today';
  if (at >= startOfToday - day) return 'Yesterday';
  if (at >= startOfToday - 6 * day) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** "2:14 PM · Today" — the time, then the day (today / yesterday / weekday / date). */
export function activityStamp(at: number): string {
  const time = new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${time} · ${dayLabel(at)}`;
}

/** Just the clock time, for a list that already groups by day. */
export function clockTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
