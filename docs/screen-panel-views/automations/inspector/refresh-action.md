# Re-run a generated block

| Selecting | What it is | Sections |
| --- | --- | --- |
| A block in the Do this view | Which generated block, and what re-running it actually does | Block · What re-running does · Record |

## Layout

| 300px |
| --- |
| block |
| what re-running does |
| record |

## Block

Which block, and where it lives.

**Shows** — `Prompt · Summarise this week's outage reports by substation.`,
`Lives in · Q3 Resilience Memo · page 2`

**Needs** — the `DerivedOutput` and its owning resource.

**Open** — the owner is a reverse query. `DerivedOutput` stores no owner pointer.

## What re-running does

The distinction that justifies the action existing at all: the block already runs
on open, so re-running is for when the answer should be ready *before* anyone
looks.

Without this sentence the action reads as a fix for staleness, and nothing in this
application is stale.

**Needs** — nothing.

## Record

A re-run leaves no run record of its own. Only this Automation's last fire and
the block's own provenance.

**Open** — that means two re-runs and two hundred are indistinguishable after the
fact. Acceptable while there is no run table; worth revisiting when there is.
