# Project Overview — the workspace

| Workspace | What it is for | Regions |
| --- | --- | --- |
| The only state this screen has | Who is here, what is addressed to you, what you can make, and everything that exists | Header · Create · Needs attention · Feed · Filters · Project work |

Three bands: identity across the top, then the two things you came for side by
side — what to make, and what is waiting on you — then everything the project
contains.

## Layout

| 2fr | 3fr |
| --- | --- |
| header | header |
| create | feed |
| create | feed |
| needs attention | feed |
| filters | filters |
| project work | project work |
| project work | project work |

*Feed* holds either mentions or activity; chips at the top of it switch between
them, and it opens on mentions.

## Header

The project's name and description, the people in it right now, and the way to
its settings.

**Shows** — `Northwind Grid Resilience` over "Winter-storm hardening case for the
2026 rate filing.", then three presence avatars, an overflow chip, and
**Settings**.

**Needs** — `Project` name and description, a presence channel, and the viewer's
permission to open settings.

## Create

The four things you can make, as a vertical list. Making a document is one line,
not a poster — a card row here would give creation more visual weight than the
work that already exists.

**Shows** — *New document*, *New slide deck*, *New spreadsheet*, *Upload file*

**Needs** — creation routes per kind, and an upload target.

## Needs attention

Directly under Create, and only present when something is wrong. It is the one
place on the screen that uses the error role.

**Shows** — *SharePoint can't sync* — Authentication expired, reconnect

**Needs** — the same health query the Health context view uses. Empty is the
normal state, and the region collapses to nothing rather than saying "all well".

## Feed

What has been addressed to you, newest first, each row naming the person, what
they did, where, and enough of what they said to decide.

**Shows** — **Mira Jain** mentioned you in a comment on **Q3 Resilience Memo** —
"@ana can you confirm 1,842,000 against the relay log?" — 2h

An agent replying in a thread you follow belongs here too. A resource changing
does not — that is Activity, behind the second chip.

**Needs** — a comment-mention query for the current user, and a per-user read
marker for the "4 new" count.

## Filters

The controls over the table below: a search, a kind filter, an actor filter, a
sort, and a count.

**Shows** — search · `All kinds` · `Anyone` · `Updated` · "24 of 24"

**Needs** — the project-work query to accept all four as parameters. The count is
matched-of-total, so a filtered view never looks like the whole project.

## Project work

Everything the project contains, as one table. Every kind is here — documents,
decks, spreadsheets, Research threads, analyses, external files, findings,
connectors — because "what is in this project" is one question.

**Shows**

| Name | Kind | Updated | Updated by |
| --- | --- | --- | --- |
| Q3 Resilience Memo | Document | 4 minutes ago | Ana Reyes |
| Why did Feeder 12 fail twice? | Research | Yesterday | Ana Reyes |
| NERC-2025-winter-review.pdf | External file | 4 days ago | SharePoint — Ops Reports |

There is no Status column. A row is a thing, not a health report — what cannot
proceed is in Needs attention and in the status bar.

**Needs** — one project-scoped query returning a `ProjectItemRef` per row: a UI
union, not a `ResourceRef`, because a Research thread is not a resource.

**Open** — not every kind stores an updating actor. *Updated by* falls back to the
latest attributable Activity, then to an em dash, and never guesses.
