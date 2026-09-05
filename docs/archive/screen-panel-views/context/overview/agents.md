# Agents overview

| View | What it is for | Sections |
| --- | --- | --- |
| Overview | What is running right now, and what is standing by | Actions · Right now · Running · Failed · Automations on |

The orientation panel for a screen whose subject changes under you: a task
finishes while you are reading a persona. So the figures are the state of the
whole screen rather than of whatever centre happens to be showing, and they stay
put while you move between the four.

**On all four of the Agents rails**, which is why it says nothing about the
persona, task or rule you happen to be on — those have panels of their own.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.project` | Model | which project the three lists are scoped to |
| `capabilities.agents.personasIn` | Capability | every persona, for the count and for naming who runs what |
| `capabilities.agents.tasksIn` | Capability | every task, with its state |
| `capabilities.agents.automationsIn` | Capability | every rule, with whether it is on and when it fires |

The project is not among them. It is read from `/app/[project]` once and carried
on the client model, so a panel that took it would be offering a second answer to
a question already settled.

## Layout

| Label | Components |
| --- | --- |
| actions | `PanelButton` ×2 |
| right now | `PanelStats` |
| running | `PanelSection` |
| failed | `PanelSection` |
| automations on | `PanelSection` |
| | `PanelNote` |

*Failed* is absent entirely when nothing has failed, rather than present and
empty. A zero there is a good outcome and does not need a row of its own.

## Actions

The two things this screen makes.

**Example** — **Persona** · **Automation**

### Structure

- `PanelButton` `tone="primary"` — **Persona**, with a plus
- `PanelButton` — **Automation**, with a bolt

### Props

`label`, `icon` and `onclick` each. Only the first is primary: a persona is the
thing you make first, and a rule is what you build once one exists.

### Behavior

Each calls `showSubscreen` with `"new"` as the focus, entering the matching
editor rather than opening a dialog. Creating one of these is entering its
editor.

## Right now

Three figures: what is in flight, what went wrong, and how many agents there are.

**Example** — `2` Running · `1` Failed · `7` Personas

### Structure

- `PanelStats` — labelled *Right now*
  - `PanelStat` ×3

### Props

Running is `tone="attention"`. Failed is `danger` only when it is non-zero, so a
clean project does not carry a red figure for a thing that has not happened.
Personas is plain: it is a size, not a state.

## Running

Every task in flight, including the ones waiting.

**Example** — "Reconcile feeder 12 outage minutes" — "Grid Analyst · 12 min ago"

### Structure

- `PanelSection` `open` `flush` — titled *Running*, with a count
  - `PanelRow` `tone="active"` ×n — one per task, with a `Bot` icon
  - `PanelNote` — "Nothing is running." where there is none

### Behavior

**Running comes first and failed comes second.** A finished task is a result you
go and read; a failed one is a thing to decide about, and the panel that orients
you should say so before it says how much has gone well — which is why completed
tasks are not a section here at all.

Selecting calls `showSubscreen("task", id)`. The panel navigates rather than
inspects: a task is a place you work.

## Failed

What went wrong, present only when something has.

**Example** — "Extract tables from NERC-2025-winter-review.pdf" — "Grid Analyst"

### Structure

- `PanelSection` `open` `flush` — titled *Failed*, with a count
  - `PanelRow` `tone="danger"` `titleTone="danger"` ×n

### Props

Both tones, because a failure has to survive being read at a glance and being
read carefully.

## Automations on

The rules that will fire without being asked.

**Example** — "Nightly digest" — "When a connector syncs"

### Structure

- `PanelSection` `flush`, closed on arrival — titled *Automations on*, with a
  count
  - `PanelRow` ×n — one per enabled rule, with a `Zap` icon
  - `PanelNote` — "Every rule is off." where none is on
- `PanelNote` `tone="gap"` — that an Automation is a task with a trigger, and its
  runs are tasks

### Behavior

*Starts collapsed.* A rule that is on is a standing arrangement rather than
something happening now, and this panel is about now.

Selecting calls `showSubscreen("automation", id)`.
