# Mentions

| View | What it is for | Sections |
| --- | --- | --- |
| Mentions | What a person addressed to you, and nothing else | Unread · Read |

A mention is addressed to you by a person. It is the one thing worth interrupting
for, which is why it leads the screen rather than sitting inside Activity, and why
machine noise is not mixed into it.

An agent replying in a thread you follow belongs here too — it was addressed at
you. A resource changing did not.

## Layout

| 300px |
| --- |
| unread |
| unread |
| unread |
| read |

## Unread

**Shows**

- *Mira Jain on Q3 Resilience Memo* — "@ana can you confirm 1,842,000…" — 2h
- *Tomas Kaur on Board Update, slide 4* — "@ana is this the chart you wanted…" — 4h
- *Mira Jain on Outage Cost Model, C2* — "@ana corrected total or the old one?" — 1d

Each row names the person, where the comment is, and enough of it to decide
whether to open it.

**Needs** — a comment-mention query for the current user, with the resource and a
location inside it.

**Open** — no per-user read marker exists, so "unread" cannot be stored yet.

## Read

The same, already seen. Starts collapsed.

**Shows** — *Tomas Kaur on Storm Hardening Options* — "@ana approved, thanks" — 3d

**Needs** — the same query, inverted on the read marker.

**Open** — whether read mentions age out, and after how long.
