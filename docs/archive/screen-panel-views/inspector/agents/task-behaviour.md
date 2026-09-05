# A task setting

| Selecting … | What it is | Sections |
| --- | --- | --- |
| A line of a task's configuration, on the task centre | What the task was told, rather than what it did | Crumbs · Value · It was told · Task · Everything it was told |

**Editable while it runs, and that is the point.** A setting you can only read is
a log entry; the reason to open this from a running task is to change what it is
allowed to do next.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.active.focus` | Model | which task, where the caller has not named one |
| `view.selection` | Model | which setting is inspected |
| `capabilities.agents.task` | Capability | the `TaskRecord`'s settings, its title and its state |
| `taskId` · `settingId` | Prop | which setting, where a caller already knows both |
| local draft | Prop | the edited value, because nothing writes a task's configuration back |

The project is not among them. It is read from `/app/[project]` once and carried
on the client model, so a panel that took it would be offering a second answer to
a question already settled.

## Layout

| Label | Components |
| --- | --- |
| crumbs | `PanelCrumbs` |
| value | `PanelSection` |
| it was told | `PanelSection` |
| task | `PanelFields` |
| everything it was told | `PanelSection` |
| | `PanelNote` |

*It was told* is present only once the draft differs from the stored value.

## Crumbs

The task, then *How it was configured*.

**Example** — Reconcile feeder 12 outage minutes › How it was configured

### Structure

- `PanelCrumbs` — the task, keyed to [its lens](task.md), then a plain segment

## Value

The setting, editable.

**Example** — "Report both figures and do not choose"

### Structure

- `PanelSection` — titled *Value*
  - `PanelEditableText` `multiline` — the draft, or the stored value where
    nothing has been typed

### Props

`value`, `label` the setting's name, `multiline`, `onchange`. Multiline because a
setting on an agentic task is usually an instruction rather than a number.

### Behavior

The draft is undefined until touched, so an untouched value still reads from the
door — which means a setting that changes underneath you is not overwritten by a
stale local copy.

## It was told

What the stored value was, beside the draft.

**Example** — "Report both figures and do not choose"

### Structure

- `PanelSection` — titled *It was told*, holding the stored value in muted ink

### Behavior

**Present only once the two differ.** A task judged against a rule that was
changed halfway is a task nobody can judge, so the original stays visible for
exactly as long as there is a change to compare it to.

## Task

Which task, and what state it is in.

**Example** — Task "Reconcile feeder 12 outage minutes" · State running

### Structure

- `PanelFields` — two fields

### Props

The state is a word rather than a chip here. The chip belongs to
[the task lens](task.md), which is about the task; this lens is about one line of
it, and a second toned chip would compete with the value above.

## Everything it was told

The rest of the configuration, so one setting is read in the context of the
others.

**Example** — *Scope* — "Field reports 2024–25"; *Stop after* — "20 tool calls";
*On disagreement* — "Report both figures and do not choose"

### Structure

- `PanelSection` `flush` — titled *Everything it was told*, with a count
  - `PanelRow` ×n, the current one marked selected
- `PanelNote` `tone="gap"` — that a change is held here and nothing writes it back

### Behavior

Selecting another replaces this lens with that one, keeping the trail. A running
task carries on under what it was originally told; the note says so, because a
draft that looked applied would be a claim about an agent's behaviour that is not
true.
