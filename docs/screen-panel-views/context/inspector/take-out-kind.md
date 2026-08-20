# Every resource of one kind

| Selecting | What it is | Sections |
| --- | --- | --- |
| A kind term, on Take out | A live rule removing everything of one kind | Rule · Right now · What that removes · Actions |

## Layout

| 300px |
| --- |
| rule |
| right now |
| what that removes |
| actions |

## Rule

**Shows** — "Every resource whose kind is **template**, whenever this is read."

Live, like every other term. A template created tomorrow is taken out too.

**Needs** — the kind term.

## Right now

**Shows** — `Takes out · 37`

**Needs** — a live count of resources of that kind within the Include side.

**Open** — whether the count is of resources of that kind in the project, or of
resources this term actually removes from this Context. Those differ whenever the
Include side is narrower than the project, and only the second is useful.

## What that removes

A sample of what disappears, so a rule that is doing more than intended is
visible. Starts collapsed.

**Shows** — *Regulatory filing shell*, *Board update*, *Cost model skeleton* · of 37

**Needs** — a bounded resolve of the removed set.

## Actions

**Move to Include** flips it. **Remove** deletes the term.
