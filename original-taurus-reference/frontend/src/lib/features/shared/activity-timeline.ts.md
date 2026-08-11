# `activity-timeline.ts`

How a long activity list becomes days — the projection behind the context rail's History lens.
`activity-timeline.test.ts` covers it.

## Why this is a module and not six lines in the panel

```ts
export type ActivityDay = { key: string; label: string; events: ActivityEvent[] };
```

The rule it encodes is easy to get wrong in a way nobody notices. The feed arrives newest-first **and
is paged**, so a single day's events routinely arrive in two different responses; and "the same day"
means the same *local calendar date*, not "within 24 hours of each other". Both mistakes produce a
list that looks plausible and is wrong — a day heading repeated halfway down, or 23:30 yesterday
filed under Today. Tests assert both cases directly.

## Keyed by date, labelled separately

```ts
function dayKey(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
```

Grouping keys on the date; the human label comes from `dayLabel` in `$data/time`. Keying on the
*label* would be the obvious shortcut and is a bug: two days a week apart can both render as "Thu",
and a label collision would merge them under one heading. The key is also what Svelte's `{#each}`
keys on, so it has to be stable as more pages load.

## Order is the caller's

```ts
export function groupEventsByDay(events: ActivityEvent[], now = Date.now()): ActivityDay[] {
```

Days come out in the order first seen, and events keep their position within a day — which for the
History lens means newest-first, because that is how `/activity` returns them. Re-sorting here would
hide a paging bug rather than surface it. `now` is injectable so the tests can pin day boundaries
without depending on the wall clock.
