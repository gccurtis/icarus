# A task

| Selecting … | What it is | Sections |
| --- | --- | --- |
| A task — a library row, a persona's work list, an Automation's run history, a Tasks view | What was asked, how far it got, and what it produced | Actions · State · Asked · Progress · Run by · Produced |

**A lens, not the manager.** Everything needed to decide *whether to go and look*
is here — what it was asked, how far it got, what it produced — and the step that
follows is a button rather than a scroll.

One lens for a task wherever it is named. An Automation's run is a task, so it
lands here too; the only thing that varies is the *Fired by* field.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.selection` | Model | which task is inspected |
| `capabilities.agents.task` | Capability | the `TaskRecord`: title, prompt, state, who started it, progress, current step |
| `capabilities.agents.resultsOf` | Capability | what it produced, and where each landed |
| `capabilities.agents.personasIn` | Capability | the persona that ran it |
| `taskId` | Prop | which task, where a caller already knows and the selection is something else |

The project is not among them. It is read from `/app/[project]` once and carried
on the client model, so a panel that took it would be offering a second answer to
a question already settled.

## Layout

| Label | Components |
| --- | --- |
| actions | `PanelButton` ×2 |
| state | `PanelFields` |
| asked | `PanelSection` |
| progress | `PanelSection` |
| run by | `PanelSection` |
| produced | `PanelSection` |
| | `PanelActions` |

## Actions

Open it, and stop or restart it.

**Example** — **Open** · **Stop**

### Structure

- `PanelButton` `tone="primary"` — **Open**
- `PanelButton` — **Stop** while it runs, **Run again** once it has stopped

### Behavior

**Open** calls `showSubscreen("task", id)` — the lens is the decision and the
centre is the work.

The second button's label is derived from state rather than being a fixed word
beside a chip that contradicts it. Neither it nor **Open** is a placeholder:
Stop and Run again have no capability behind them, which is stated at the foot
rather than by a disabled control that gives no reason.

## State

The four facts that place a task without reading anything.

**Example** — State `running` · Started by Ana Reyes · Started 12 min ago · Fired
by `Automation`

### Structure

- `PanelFields`
  - `PanelChip` — the state, toned `attention` running, `neutral` waiting,
    `success` completed, `danger` failed
  - `PanelChip` `tone="accent-1"` — *Automation*, on the *Fired by* row

### Props

*Fired by* is absent rather than negated on a task a person started. A row saying
"not an automation" is a row about something that is not there.

## Asked

The prompt, clamped to four lines.

**Example** — "Reconcile the outage minutes on feeder 12 against the relay log
for both events, and say where the two disagree."

### Structure

- `PanelSection` — titled *Asked*, holding the prompt

### Behavior

**Clamped, unlike on the task centre.** A lens that held 300 characters of prose
would push the decision off the bottom of a 320px panel — and the whole point of
this lens is that the decision fits in it. The centre is where the prompt is
shown in full.

## Progress

How far along, and what it is doing now.

**Example** — "How far along" · 62% · "Reading the relay log for the second
event"

### Structure

- `PanelSection` — titled *Progress*
  - `PanelMeter` — the percentage, with the current step as its detail

### Props

`label`, `detail`, `value`, and `tone` — `danger` on a failed task, `attention`
while it runs, `success` once it is done. A bar rather than a figure, because the
question is *how much is left* and a percentage answers that badly on its own.

## Run by

Which persona.

**Example** — Grid Analyst — "Reads field data and relay logs; refuses to
speculate past the record."

### Structure

- `PanelSection` `flush` — titled *Run by*
  - `PanelRow` — the persona's name and description

### Behavior

Selecting opens [the persona](persona.md) rather than navigating, because from a
lens the persona is a fact about this task rather than a place to go.

## Produced

What has come out so far.

**Example** — "Estimated 1,840,200 customer-minutes" — "Relay log disagrees with
the outage report by 1,800" — `Outage Cost Model`

### Structure

- `PanelSection` `flush` — titled *Produced*, with a count
  - `PanelRow` ×n — one per result, `meta` the resource it landed in
  - `PanelNote` — "Nothing yet."
- `PanelActions` → `PanelNote` `tone="gap"` — that Stop and Run again do nothing

### Behavior

Selecting one opens [the result](task-results.md). The count is the honest
measure of a task: a run with a high percentage and no results is a run that has
been busy.
