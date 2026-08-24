# Agents — the library

| Workspace | What it is for | Regions |
| --- | --- | --- |
| The centre this tab opens on | Every persona in reach, and every task they are running | Header · Personas · Tasks |

One column, three bands: who the agents are, then what they are doing. The task
table gets the depth because it is the band that changes minute to minute; the
persona grid above it is a roster and settles.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.project` | Model | which project the two lists are scoped to |
| `capabilities.agents.personasIn` | Capability | a `PersonaRow` per agent: name, description, scope, and its task counts |
| `capabilities.agents.tasksIn` | Capability | a `TaskRow` per task: title, persona, who or what started it, state, age |
| `view.selection` | Model | which card or row is inspected |

The project is not among them. It is read from `/app/[project]` once and carried
on the client model, so a workspace that took it would be offering a second
answer to a question already settled.

## Layout

| 1fr |
| --- |
| header |
| personas |
| tasks |
| tasks |

## Header

What the screen is, and the two things it makes.

**Example** — "Agents" over "Personas are the behaviour; tasks are the work. An
Automation is a task with a trigger.", then **New persona** and **New
automation**

### Structure

- `ScreenHeader` — title and `about`, with the two creates in its `actions`
  snippet
  - `ScreenAction` ×2 — **New persona** and **New automation**, because the two
    things this screen makes are made in two different centres

### Props

`title`, `about`, and `label`/`icon`/`onclick` on each action. The subtitle
carries the one sentence that explains why personas and automations are one
screen.

### Behavior

**New persona** calls `showSubscreen("persona", "new")` and **New automation**
`showSubscreen("automation", "new")`. Neither opens a modal: creating one of
these is entering its editor, and a dialog in front of that would be a form
asking for the name the editor is about to ask for again.

## Personas

The roster, as folders before it is cards. Whose an agent is decides who may edit
it, so the three scopes are the first division rather than a filter chip.

**Example** — three folders, `Project` "4 personas" · `Shared` "2 personas" ·
`Personal` "1 persona"; opened, a card reading *Grid Analyst* — "Reads field data
and relay logs; refuses to speculate past the record." — `41 tasks · 2 running`

**Nests** — the folder grid and the card grid share the slot; searching replaces
both with matches

### Structure

- `ScreenFilters` — the persona search, with a **All personas** `Button` back out
  of an open folder
- `ScreenGroup` — labelled with the open folder's name, or *Personas*
  - `ScreenCards` `min="14rem"` — one `ScreenCard` per scope, at the top level
  - `ScreenCards` `min="16rem"` — one `ScreenCard` per persona inside a folder
    - `PanelActor` `kind="agent"` `size="face"` — the card's `thumb`
    - `PanelChip` — the record, and the scope while searching
  - `ScreenEmpty` — an empty folder, or nothing matching

### Props

Folder cards take `title` the scope, `sub` the count, and `icon={Folder}`.
Persona cards take `title`, `sub` the description, `selected` and `onselect`. The
record chip reads `41 tasks · 2 running`, and drops the second clause at zero so
that a quiet persona reads as quiet.

### Behavior

**Searching flattens the folders.** A search is a question about all of them, and
making someone open three folders to answer it is the folder winning over the
question — so a non-empty search ignores the open folder entirely and shows every
match, with a scope chip on each card because no folder is there to say it.

Single click inspects, double click opens the persona centre. Two acts: you have
to be able to look at a persona without leaving the list you were comparing it
against.

## Tasks

Every task in the project, as one table, filtered four ways and sorted with a
direction of its own.

**Example**

| Task | Persona | Started by | State | Started |
| --- | --- | --- | --- | --- |
| Reconcile feeder 12 outage minutes | Grid Analyst | Ana Reyes | `running` | 12 min ago |
| Nightly digest — 14 Nov | Grid Analyst | Automation | `completed` | 9 h ago |

### Structure

- `ScreenGroup` — labelled *Tasks*, its `actions` snippet holding the direction
  - `Button` — **Ascending** / **Descending**
- `ScreenFilters` — search, sort, and three `select`s: managing persona, state,
  and whether a person or an Automation started it
- `ScreenTable` — five columns
  - `ScreenRow` — one per task
    - `PanelChip` `tone="accent-1"` — *Automation*, on a row a rule fired
    - `PanelChip` — the state, toned `attention` running, `neutral` waiting,
      `success` completed, `danger` failed

### Props

`ScreenFilters` takes `placeholder`, `matched`, `total`, `sorts` and a bound
`sort`. The sorts are Time started, State, Persona and Task. The count is
matched-of-total, so a filtered table never reads as the whole project.

### Behavior

**Direction is a control, not a property of the order.** Newest-first is what
anybody wants of *Time started* and A–Z is what anybody wants of a name, so the
button starts pointed the way each order is usually read rather than always
descending — and the label says which way it is pointing rather than drawing an
arrow that has to be learned.

Clicking a task's name inspects it; double-clicking the row opens the task
centre. Clearing is one control: the empty state's **Clear** resets the search
and all three filters at once, because a table that matches nothing usually has
more than one filter to blame.
