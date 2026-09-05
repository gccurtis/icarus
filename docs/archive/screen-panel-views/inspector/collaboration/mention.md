# A mention

| Selecting | What it is | Sections |
| --- | --- | --- |
| A mention, from the Mentions view or the centre feed | One comment addressed to you, what it is attached to, and what to do about it | Mention · Comment · Anchored to · Actions |

Enough to answer it without opening the document, and one click to open the
document if you need to.

## Layout

| 300px |
| --- |
| mention |
| comment |
| anchored to |
| actions |

## Mention

Who, where, when.

**Shows** — `From · Mira Jain`, `Where · Q3 Resilience Memo · page 2`, `When · 2 hours ago`

**Needs** — `Comment` author, its resource anchor, and a location inside the
resource that can be named ("page 2", "C2", "slide 4").

**Open** — the location string differs per resource kind. Each editor has to
supply it; it cannot be derived generically from an anchor.

## Comment

The comment itself, in full.

**Shows** — "@ana can you confirm 1,842,000 against the relay log? The event log
says 1,840,200."

**Needs** — comment body.

## Anchored to

The exact text the comment is attached to, so the question makes sense without
the surrounding document.

**Shows** — "nearly a third of customer-minutes lost"

**Needs** — the anchored range resolved to its current text.

**Open** — the anchor can be stale relative to an edited document. Whether to show
the original text, the current text at that anchor, or an explicit "the text this
was on has changed" needs deciding.

## Actions

**Open in context** navigates to the resource and the anchor. **Reply** posts back
into the thread. **Mark read** clears it.

**Needs** — a per-user read marker, which does not exist.
