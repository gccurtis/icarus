# Analysis — all analyses

| Workspace | What it is for | Regions |
| --- | --- | --- |
| Entered from the Analyses view | Every chart built on this project's variables | Header · Filters · Analyses · Note |

## Layout

| 1fr |
| --- |
| header |
| filters |
| analyses |
| analyses |
| note |

## Header

**Shows** — "Analysis" over "Every chart built on this project's variables. One
Analysis tab — which one you are on is view state.", and **New analysis**

**Needs** — the create route.

## Filters

**Shows** — a search, then `All` · `Charts` · `Tables`

**Needs** — the analysis query to accept a search and a display-kind filter.

## Analyses

Cards, not rows. A chart is a shape, and a thumbnail of its shape identifies it
faster than its title does.

**Shows** — a bar-shaped thumbnail, then *Outage minutes by substation* — Bar · 6
of 41 rows

**Needs** — the project's analyses with display kind and last complete
materialized component. A bounded thumbnail can derive from that component
without executing every definition.

**Open** — the row count and thumbnail describe the last materialization and may
be stale. The card must show that status rather than imply current evaluation.

## Note

One line: the last complete component is available immediately; opening one
checks current variables and marks it stale while a newer result evaluates.

**Needs** — nothing.
