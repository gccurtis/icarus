# Automations

| View | What it is for | Sections |
| --- | --- | --- |
| Automations | Every rule, by state | Not working · On · Off |

Ordered by what needs attention: broken, live, dormant.

## Layout

| 300px |
| --- |
| actions |
| search |
| not working |
| on |
| on |
| off |

## Not working

Rules that are on and cannot dispatch, with the reason on the row.

**Shows** — *Nightly filing digest* — Agent may not use web.search

The reason is usually a configuration failure elsewhere — a persona missing a
tool, a connector unauthenticated — which makes it fixable rather than merely
reportable.

**Needs** — enabled `Automation` records whose last fire failed, with a reason.

## On

Live rules, each summarised by its trigger, since that is what distinguishes two
rules that both ask an agent for something.

**Shows** — *Refresh outage summary* — When SharePoint syncs; *Brief on new
finding* — When a finding is accepted

**Needs** — enabled records with a rendered trigger phrase.

## Off

**Shows** — *Weekly board pack* — Never fired

**Needs** — disabled records.

## Panel furniture

The action row: **New**, **Open**, **Run now**, **Duplicate**. A search over
Automations.

Duplicating one leaves the copy off, so it cannot fire before it has been read.
