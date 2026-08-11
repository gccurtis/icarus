# `change-lookup.ts`

Resolves an **activity event** to the document **change** behind it, for the Overview lenses.
`$systems/documents/change-detail` renders a change; this decides *which* change an event means.

## The 1:1 that makes this possible

A document `edited` event **is** exactly one change set — not a roll-up of several edits. Omega
writes both in a single atomic call from one timestamp:

```go
createdAt := d.now().UTC()
changeSet.CreatedAt = createdAt
cs, err := d.store.AppendChangeSet(changeSet, admissionRevision,
    newActivityFact(doc, actor, ActivityEdited, createdAt, "document.change_set", changeSet.ID))
```

and `activity_events` carries `UNIQUE (source_kind, source_id)`. It also explains why a typing
session produces a run of near-identical `edited` rows: the editor flushes several change sets, and
each one is an event.

## Matching by timestamp is an interim

```ts
export function findChangeEntry(entries: HistoryEntry[], event: ActivityEvent): HistoryEntry | null {
  return entries.find((entry) => entry.occurredAt === event.occurredAt) ?? null;
}
```

Omega stores the change-set id **on the event** (`source_id`) and reads it back, but `eventJSON`
does not serialise it — so the shared `createdAt` is the only visible link. The match is exact
rather than fuzzy, but it leans on an invariant nothing enforces: two change sets in the same
millisecond would tie, and `Date.parse` discards the nanoseconds that would otherwise separate them.
Serialising the id is a ~2-line backend change; switch to it when it lands.

## Two entry points, deliberately

`loadEventChange` is the one-shot: history, match, detail. `ActivityLens` uses it for the single
change it shows immediately.

`findChangeEntry` + `loadChangeDetail` are the pair. `ActivityList` reads history **once** for the
whole list, on the first expansion, and reuses it for every later one — a list where three rows get
expanded should cost one history read, not three. Fetching up front instead would pay for a panel
the user may never open.

`loadChangeDetail` takes the full `entries` page, not just the matched entry, because the
before-text reconstruction needs the change sets *older* than this one:

```ts
const index = entries.findIndex((e) => e.id === entry.id);
const older = index >= 0 ? entries.slice(index + 1).map((e) => e.id) : [];
```

History is newest-first, so everything after the index is older. Reversing that sort order would
silently invert the walk.

## `EventChange`

A discriminated union rather than loose fields, so the renderer has no impossible states to guard:
`loading` · `ready` (with `priorUnknown` distinguishing "no earlier text existed" from "we could not
recover it") · `pruned` · `none` (a rename or create — nothing edited content) · `error`.
