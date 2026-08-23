# Overview

| View | What it is for | Sections |
| --- | --- | --- |
| Overview | The analysis itself: what it is called, whether it is saved, what it last produced | This analysis · Saved · Result · Attribution |

## Layout

| 300px |
| --- |
| actions |
| this analysis |
| this analysis |
| saved |
| result |
| attribution |

## This analysis

Title and description, both editable. A chart needs a description more than most
things do — the title says what is plotted, the description says why.

**Shows** — `Title · Outage minutes by substation`, `Description · Storm-season
load on the worst substations.`

**Needs** — the analysis record's title and description.

## Saved

**Shows** — `Saved · revision 12`

Saving is revision-CAS on the current state. Undo covers unsaved builder actions
only — there is no durable change-set history here, and the section must not
imply one.

**Needs** — the current revision and dirty state.

## Result

What the last evaluation produced. Every number here is about the run, not about
the definition.

**Shows** — `Rows · 6 of 41`, `Limit · 10`, `Evaluated · 2 minutes ago`

The editable definition and last complete analytic component are persisted
together. A new evaluation replaces that materialization only when it completes;
until then every surface can continue to render the last good chart or table and
show its freshness or issue state.

**Needs** — the evaluator's last result metadata.

## Attribution

Starts collapsed.

**Shows** — `Created by · Mira Jain`, `Updated · 2 minutes ago`

**Needs** — creator actor and update time.

## Panel furniture

**Run again** in the action row.
