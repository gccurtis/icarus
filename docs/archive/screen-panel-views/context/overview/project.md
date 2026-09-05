# Overview

| View | What it is for | Sections |
| --- | --- | --- |
| Overview | The project itself — what it is, what state it is in, who is here, and what is waiting on you | This project · State · Here now · Needs you · Dates |

The first rail entry, and the default. It answers "where am I and what is
outstanding" without requiring a click.

## Layout

| 300px |
| --- |
| actions |
| this project |
| this project |
| state |
| state |
| here now |
| needs you |
| dates |

## This project

Name and description, both editable in place.

**Shows** — `Name · Northwind Grid Resilience`, `About · Winter-storm hardening
case for the 2026 rate filing.`

**Needs** — `Project` name and description, with write access for members who may
edit.

## State

The few facts that qualify everything else on the screen.

**Shows**

| | |
| --- | --- |
| Status | Active |
| Your role | Owner |
| Members | 7 |
| Project work | 24 items |

**Needs** — project state, the viewer's role, a member count, and a count of
project work. *Project work* is the same count the centre table shows, so both
must come from one query.

## Here now

Who is in the project at this moment, as avatars. Each opens that person.

**Shows** — three avatars, hover-named, plus an overflow chip.

**Needs** — an ephemeral presence channel. Not `lastSeenAt`, not Activity.

## Needs you

The two kinds of thing that warrant an interruption: a person addressed you, or
something is broken.

**Shows** — *4 mentions · Unread*, *SharePoint can't sync · Authentication expired*

**Needs** — an unread-mention count per user, and the same health query the Health
view uses.

**Open** — the unread count needs a per-user read marker on mentions, which is not
modeled.

## Dates

Created and updated. Starts collapsed.

**Shows** — `Created · 12 Mar 2026`, `Updated · 4 minutes ago`

**Needs** — timestamps on `Project`.

**Open** — `Project` records no creator or updater actor, so these are dates only.

## Panel furniture

**Settings** in the action row.
