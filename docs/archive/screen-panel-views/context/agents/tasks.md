# Tasks

| View | What it is for | Sections |
| --- | --- | --- |
| Tasks | Every task in this project, grouped by whether it needs you | Search · Persona · Running · Failed · Done |

The map for the Agents screen: what the library's table holds, in the narrow
column, so you can move between tasks without going back to the library.

On the library rail and the task rail, because the reason to have it is to get
from one task to the next.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.project` | Model | which project the tasks are scoped to |
| `capabilities.agents.tasksIn` | Capability | a `TaskRow` per task: title, persona, state, when it started, results, and whether a rule fired it |
| `capabilities.agents.taskGroup` | Capability | which of the three groups a row belongs to |
| `view.active.focus` | Model | which task the centre is on, for the selected row |

The project is not among them. It is read from `/app/[project]` once and carried
on the client model, so a panel that took it would be offering a second answer to
a question already settled.

## Layout

| Label | Components |
| --- | --- |
| search | `PanelSearch` |
| persona | `PanelSelect` |
| running | `PanelSection` |
| failed | `PanelSection` |
| done | `PanelSection` |

Two controls and three groups. There is no state filter, because the groups are
the states — a chip that hid two of three sections would be doing the sections'
job worse.

## Search

The field, and what it narrows.

**Example** — placeholder "Search tasks", "9 of 24", "No task matches."

**Nests** — persona, running, failed, done

### Structure

- `PanelSearch` `flush` — the field, its matched-of-total count, and its own
  nothing-matches sentence, wrapping everything below it

### Props

`placeholder`, `matched`, `total`, `empty`, `value`. Narrows by title only: a
task is found by what it was asked to do.

## Persona

Which agent's work to show.

**Example** — "Persona" · `Any persona ▾`

### Structure

- `PanelSelect` — Any persona, then one option per persona

### Props

`label`, `value`, `options`, `onchange`. A select rather than chips: a project
has as many personas as it likes, and a chip per agent would wrap to three lines
in a 300px column.

## Running

What is in flight, including what is waiting.

**Example** — "Reconcile feeder 12 outage minutes" — "Grid Analyst · 12 min ago"

**Nests** — nothing; *Failed* and *Done* are siblings with the same shape

### Structure

- `PanelSection` `open` `flush` — titled *Running*, with a count
  - `PanelRow` `tone="active"` ×n — one per task

### Props

Each row takes `title` the task, `sub` the persona and when it started, `icon` a
`Zap` where a rule fired it and a `Bot` otherwise, `selected` against the
centre's focus, and `onselect`.

### Behavior

**The icon says who asked, not what state it is in.** State is the section, so
spending the glyph on it would say the same thing twice and leave the more useful
fact unsaid.

Selecting calls `showSubscreen("task", id)`. **The panel navigates rather than
inspects**: a task is a place you work rather than a thing you glance at, and the
row is already showing everything a lens would put at the top.

## Failed

What went wrong.

**Example** — "Extract tables from NERC-2025-winter-review.pdf" — "Grid Analyst"

### Structure

- `PanelSection` `open` `flush` — titled *Failed*, with a count
  - `PanelRow` `tone="danger"` `titleTone="danger"` ×n

### Behavior

**Three groups, and *failed* is its own.** Rolling failures in with finished work
is how a run that produced nothing gets counted as one that did.

## Done

What has finished, with what it produced.

**Example** — "Nightly digest — 14 Nov" — "Grid Analyst · 7 results"

### Structure

- `PanelSection` `flush`, closed on arrival — titled *Done*, with a count
  - `PanelRow` ×n

### Props

`sub` is the persona and the result count, because the only question left about a
finished task is whether anything came out of it.

### Behavior

*Starts collapsed.* It is the longest of the three and the least urgent, and a
panel that opened onto forty completed tasks would bury the two that are running.
