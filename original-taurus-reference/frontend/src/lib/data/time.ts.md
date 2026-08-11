# src/lib/data/time.ts — breakdown

Companion to [time.ts](time.ts). Unified time formatting module — the single source
for timestamp display across the cockpit, gathering four formatters that used to live
in three separate files.

## Module purpose

### What this module unifies and where each formatter came from

```ts
/**
 * Unified time formatting for every surface in the cockpit.
 *
 * Migrated from four scattered implementations:
 *   resources.ts    — relativeTime    (compact "3h ago")
 *   doc-collab.ts   — documentEditStamp   (full "Jul 23, 2026, 3:14 PM")
 *   doc-collab.ts   — documentEditRelative ("5 minutes ago")
 *   overview.ts     — activityStamp  ("2:14 PM · Today")
 */

```

The module doc comment is the migration ledger: each of the four exports below was
lifted verbatim from `resources.ts`, `doc-collab.ts` (two of them), or `overview.ts`,
and the comment records the original home and sample output of each so the consolidation
is traceable.

## relativeTime

### Compact relative time for resource tables

```ts
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

```

`relativeTime` walks the elapsed span through widening buckets — minutes, hours, days,
weeks — returning the first that fits (`just now`, `5m ago`, `3h ago`, `2d ago`,
`4w ago`). Past five weeks it gives up on relative phrasing and falls back to a locale
date. This is the terse form the resource tables use.

## documentEditStamp

### A complete date-and-time label for the document bar

```ts
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

```

`documentEditStamp` produces the full absolute label (e.g. "Jul 23, 2026, 3:14 PM") for
the document bar. It guards against a non-finite or non-positive timestamp by returning
`unknown time`, then defers to `toLocaleString` with an explicit month/day/year/hour/minute
format.

## documentEditRelative

### Human relative time for the quiet center status

```ts
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

```

`documentEditRelative` is the fuller, grammatical relative form ("5 minutes ago") built
on `Intl.RelativeTimeFormat`, so it localizes and handles pluralization. It takes an
injectable `now` (defaulting to the clock) for testability, guards bad input with
`at an unknown time`, short-circuits sub-minute spans to `just now`, and otherwise picks
the largest unit whose threshold the magnitude clears. `delta` keeps its sign so past
times read "ago" and future times read "in".

## dayLabel, activityStamp, clockTime

### One day classifier, two callers

```ts
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

export function activityStamp(at: number): string {
  const time = new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${time} · ${dayLabel(at)}`;
}

export function clockTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
```

`dayLabel` classifies a timestamp into `Today`, `Yesterday`, a short weekday name within the last
week, or a `month day` date beyond that. It anchors on **midnight local** (`startOfToday`), not on a
24-hour offset from now — 23:30 yesterday and 00:30 today are an hour apart and belong to different
days.

It was **extracted from `activityStamp` on 2026-07-29** (the context-rail pass) so the History
lens's day headings and the activity feed's per-event stamps cannot disagree about where a day
starts; `activityStamp` now composes it. The injectable `now` is what lets
`activity-timeline.test.ts` assert day boundaries without depending on the wall clock.

`clockTime` is the time alone, for a list that already carries the day in a heading — the rail's
History lens, whose rows sit under a `Today` / `Yesterday` / `Fri` group label.
