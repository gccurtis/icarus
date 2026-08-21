# Comments

| View | What it is for | Sections |
| --- | --- | --- |
| Comments | Conversation on this document | Scope chips · Open · Resolved |

## Layout

| 300px |
| --- |
| scope chips |
| open |
| open |
| resolved |

## Scope chips

Three chips narrowing the list: the whole document, the current page, or the
current selection.

**Shows** — `Document` · `Page 2` · `Selection`

**Needs** — comment anchors resolvable to a computed page and comparable to the
current selection range.

**Open** — "Page 2" is a computed filter over a stored anchor. A comment does not
know what page it is on; the layout does.

## Open

Unresolved threads, newest first, with the comment text on the row. A thread that
mentions you is marked, because that is why you would look.

**Shows**

- Mira Jain — "@ana can you confirm 1,842,000…" — 2h
- Mira Jain — "Cite the docket number here." — 1d

**Needs** — `Comment` threads anchored to this document, with author, body, time,
and whether the current user is mentioned.

## Resolved

Starts collapsed.

**Shows** — Ana Reyes — "Fixed the units." — 3d

**Needs** — resolved state on the thread.
