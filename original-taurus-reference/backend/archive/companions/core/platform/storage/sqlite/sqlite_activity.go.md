# sqlite_activity.go

The read side of the activity feed: two queries over `activity_events`, one
paging a project's events newest-first and one summarising the most recent event
per project.

This file holds no writes. Events are recorded elsewhere; `activity.Store` is
declared as a read-only port, and these two methods are its SQLite
implementation. Like every file in the package it hangs its methods off the
shared `*Store` and uses the one connection opened in `sqlite.go` — the split
into `sqlite_<capability>.go` files mirrors the capability boundaries in
`core/capability` so each domain's storage reads on its own.

## Code breakdown

### ListActivity: a keyset-paged, optionally target-scoped feed

`ListActivity` builds its SQL incrementally. The base clause selects a project's
events; a non-empty `targetID` adds `AND target_id = ?`, narrowing the feed to
one resource (a document's own history rather than the whole project's). Results
are ordered `occurred_at DESC, id DESC` and capped by `limit`, which matches the
`idx_activity_project_time` index declared in `sqlite_migrate.go`, so the query
is an index scan rather than a sort.

Paging is *keyset*, not offset. A caller passes back the last event it saw as an
`activity.Boundary` (an `OccurredAt` plus an `ID`), and the query resumes strictly
after it:

```sql
AND (occurred_at < ? OR (occurred_at = ? AND id < ?))
```

The two-part comparison exists because `occurred_at` is not unique — several
events can share a timestamp. Comparing on the timestamp alone would either skip
or repeat the tied rows at a page boundary; adding `id` as a tiebreaker, in the
same direction as the `ORDER BY`, makes the cursor total. This is also why the
boundary is encoded with `sortableTime` rather than `timeLayout`: the comparison
happens in SQL against stored *text*, so the fractional second must be
fixed-width or lexical order would diverge from chronological order. Rows are
read back with `timeLayout`, which parses both forms.

`Action` is stored as plain text and converted to the typed `activity.Action` on
scan. The output slice is preallocated to `limit`, and `rows.Err()` is returned
so a truncated result set surfaces as an error rather than a short page.

### LatestActivityByProjects: newest timestamp per project, in one round trip

`LatestActivityByProjects` answers "when did each of these projects last see
activity" for a list of projects at once — the data a project picker sorts on.
It returns an empty map immediately for an empty input, both to avoid an invalid
`IN ()` and to skip a pointless query.

Because `database/sql` has no variadic `IN` binding, the placeholder list is
built by repetition and the ids copied into an `[]any`, keeping every id a bound
parameter rather than interpolated text. The query is a single
`SELECT project_id, MAX(occurred_at) ... GROUP BY project_id`, so N projects cost
one round trip instead of N. Projects with no events simply do not appear in the
result map, leaving the caller to treat a missing entry as "no activity" rather
than needing a zero row.
