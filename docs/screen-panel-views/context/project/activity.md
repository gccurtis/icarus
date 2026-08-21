# Activity

| View | What it is for | Sections |
| --- | --- | --- |
| Activity | What has happened in the project, newest first | Filters · Today · Earlier days |

The record. Everything an actor did, in order, with no judgment about whether it
matters — that judgment is what Mentions and Health are for.

## Layout

| 300px |
| --- |
| search |
| filters |
| today |
| today |
| earlier days |
| earlier days |

## Filters

Three chips above the list: a time window, an actor, and a target.

**Shows** — `Today` · `Anyone` · `Any target`

**Needs** — the activity query to accept all three as parameters. Filtering
client-side over a paged list gives wrong counts.

## Today

**Shows**

- **Ana Reyes** edited Q3 Resilience Memo — 4m
- **Nightly filing digest** started a task — 3h
- **Tomas Kaur** created Board Update — 5h

Each row is actor, verb, target. The actor is a link.

**Needs** — `Activity` with an actor reference, an event kind, and a target
reference resolvable to a name.

## Earlier days

Older days, each its own section, collapsed. A day with many events collapses
further into one digest row that expands.

**Shows** — *Yesterday · 14 events* → **Grid Analyst** accepted 6 findings — Digest, expand to see each

**Needs** — server-side grouping by day and by actor-plus-verb, or the digest
row is a client-side guess at what belongs together.

**Open** — what threshold turns a day into a digest, and whether a digest row
should be inspectable at all when it stands for six events.

## Panel furniture

One search field, pinned under the pane title, filtering every section at once
rather than only the one it sits above.
