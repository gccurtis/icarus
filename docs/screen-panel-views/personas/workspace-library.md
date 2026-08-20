# Personas — all personas

| Workspace | What it is for | Regions |
| --- | --- | --- |
| Entered from the Personas view | Every agent available here | Header · Filters · Personas |

## Layout

| 1fr |
| --- |
| header |
| filters |
| personas |
| personas |

## Header

**Shows** — "Personas" over "Reusable agent behaviour. Provider credentials and
deployment setup stay outside project data.", and **New Persona**

**Needs** — the create route. The subtitle draws the boundary this screen keeps.

## Filters

**Shows** — a search, then `All` · `This project` · `Everywhere`

**Needs** — the persona query to accept a search and a scope.

## Personas

Cards: face, name, what it does, and what it has done.

**Shows** — an avatar and "Grid Analyst", then "Reads field data and relay logs;
refuses to speculate past the record.", then `41 tasks · 2 running`

The work chip is the identifying detail. Two agents with similar descriptions are
told apart by their records, not their prose.

**Needs** — `Persona` records with avatar, name and description, and a per-persona
task aggregate.

**Open** — that aggregate does not exist. Counting client-side does not survive
the first page of tasks.
