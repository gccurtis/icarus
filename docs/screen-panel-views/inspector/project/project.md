# The project

| Selecting | What it is | Sections |
| --- | --- | --- |
| Nothing, the project header, or a Create row | The project itself — the default lens on this screen | Identity · People · Dates · Project actions |

What the inspector shows when nothing more specific is selected. It is also where
the Settings button lands.

## Layout

| 300px |
| --- |
| identity |
| identity |
| people |
| dates |
| project actions |

## Identity

**Shows**

| | |
| --- | --- |
| Name | Northwind Grid Resilience |
| Description | Winter-storm hardening case for the 2026 rate filing. |
| State | Active |
| Your role | Owner |

**Needs** — `Project` name, description and state, plus the viewer's role.

## People

Membership as a count per role, with faces underneath.

**Shows** — `Owners · 2`, `Editors · 4`, `Viewers · 1`, then four avatars and an overflow

**Needs** — membership grouped by role. The model permits several owners and
requires at least one, which is what makes Owners a count rather than a name.

## Dates

Starts collapsed.

**Shows** — `Created · 12 Mar 2026`, `Updated · 4 minutes ago`

**Needs** — timestamps on `Project`.

**Open** — no creator or updater actor field exists, so this cannot say who.

## Project actions

Starts collapsed. **Settings** and **Archive**.

**Open** — archive semantics are undefined: whether an archived project is
readable, whether its Automations stop, and whether it can be un-archived.
