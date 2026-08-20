# A comment

| Selecting | What it is | Sections |
| --- | --- | --- |
| A comment in the Comments view, or a marker in the gutter | One thread: what was said, what it is attached to, and the replies | Thread · Comment · Anchored to · Replies · Actions |

## Layout

| 300px |
| --- |
| thread |
| comment |
| anchored to |
| replies |
| actions |

## Thread

State and whether it concerns you, then who started it and when.

**Shows** — `Open` · `Mentions you`, then `Started by · Mira Jain`, `When · 2 hours ago`

**Needs** — thread state, mention detection for the current user, author and time.

## Comment

The first message, in full.

**Shows** — "@ana can you confirm 1,842,000 against the relay log? The event log
says 1,840,200."

**Needs** — the comment body.

## Anchored to

The text the thread is attached to.

**Shows** — "nearly a third of customer-minutes lost"

**Needs** — the anchor resolved to current text.

**Open** — an anchor whose text has since changed, or been deleted, needs a
defined presentation. Silently showing the current text at that position is
wrong.

## Replies

**Shows** — Ana Reyes · "Checking against the relay log." — 1h

**Needs** — replies on the thread.

## Actions

**Reply**, **Resolve**.
