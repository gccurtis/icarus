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

**Needs** — the project's analyses with display kind, and a thumbnail rendered by
running each — or a defer to a placeholder shape.

**Open** — the row count on a card describes a result that no longer exists.
Rendering a real thumbnail means evaluating every analysis to draw the library.

## Note

One line: nothing about a result is stored, so opening one runs it again against
the variables as they are now.

**Needs** — nothing.
