# Agents — one task

| Workspace | What it is for | Regions |
| --- | --- | --- |
| Entered by opening a task row | One agentic task: what it was asked, how it is going, and how to steer it | Bar · Overview · Config · Progress · Chat |

The prompt, then the configuration beside the progress, then the conversation
that changes both. An Automation's run lands here too — a run is a task, and the
task is what carries the results.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.active.focus` | Model | which task this is |
| `capabilities.agents.task` | Capability | the `TaskRecord`: prompt, persona, who started it, state, progress, current step, settings |
| `capabilities.agents.resultsOf` | Capability | a `TaskResult` per thing it produced, and where each landed |
| `capabilities.agents.chatIn` | Capability | the steering turns and the agent's own progress notes, interleaved |
| `capabilities.agents.personasIn` | Capability | the persona's name and face |
| local draft | Prop | what has been typed but not sent, because no agent capability exists to send it to |

The project is not among them. It is read from `/app/[project]` once and carried
on the client model, so a workspace that took it would be offering a second
answer to a question already settled.

## Layout

| 2fr | 3fr |
| --- | --- |
| bar | bar |
| overview | overview |
| config | progress |
| chat | chat |

**Configuration left, progress right.** What it was told does not change while it
runs; what it has produced changes every minute. Reading down the right-hand
column is the thing someone does repeatedly, so it is the column that stays put.
The chat takes the full width because a turn is a sentence and a sentence wants a
measure. Below 64rem the bands stack with progress above config, because on a
narrow screen the first question is still *where has it got to*.

## Bar

Which task, what state it is in, and the way back.

**Example** — ← **All agents** · "Reconcile feeder 12 outage minutes" ·
`running` `Automation`

### Structure

- `ScreenBar` — title, back, and a `meta` snippet
  - `PanelChip` — the state, toned `attention` running, `neutral` waiting,
    `success` completed, `danger` failed
  - `PanelChip` `tone="accent-1"` — *Automation*, present only on a fired run

### Behavior

Back calls `showSubscreen("library")`, whether the task was reached from the
library, a persona or an Automation. One way out, always to the same place:
a back button that remembered where you came from would send two people who
pressed the same button to two different screens.

## Overview

What it was asked, verbatim, and who is involved.

**Example** — a rule-quoted paragraph: "Reconcile the outage minutes on feeder 12
against the relay log for both events, and say where the two disagree." — then a
Grid Analyst face, "Started by Ana Reyes, 12 min ago", and **Fired by an
Automation**

### Structure

- `blockquote` — the prompt in full, with a start rule
- `PanelActor` `size="row"` in a button — the persona
- the starter, with a `User` glyph
- a button reading **Fired by an Automation**, only on a fired run

### Props

The quote is the stored prompt, unshortened. `PanelActor` takes `name`,
`kind="agent"`.

### Behavior

**The prompt is on the screen, in full.** A task is only judgeable against what
it was actually told, and putting that behind a lens makes every reading of the
results a guess. The row's title in the library is this sentence shortened; here
it is the sentence.

The persona opens `showSubscreen("persona", id)` and the Automation link
`showSubscreen("automation", firedBy)`. Both navigate: from a task, the persona
and the rule are places rather than facts.

## Config

What it was told, one line per setting.

**Example** — *Scope* — "Field reports 2024–25"; *Stop after* — "20 tool calls";
*On disagreement* — "Report both figures and do not choose"

### Structure

- `ScreenGroup` — labelled *How it was configured*
  - `ScreenList` → `ScreenItem` ×n — one per setting, with a `Boxes` lead

### Props

Each takes `title` the setting's name, `excerpt` its value, `selected` and
`onselect`.

### Behavior

Selecting opens [the setting's lens](../../inspector/agents/task-behaviour.md),
which is editable while the task runs. That is the point of opening it from a
running task: the reason to look is to change what it is allowed to do next.

## Progress

Where it has got to, and what has come out so far.

**Example** — `62%` Done so far · `3` Results, then "Reading the relay log for
the second event"; below, *Estimated 1,840,200 customer-minutes* — "Relay log
disagrees with the outage report by 1,800" — `Outage Cost Model`

### Structure

- `ScreenGroup` *Where it is*
  - `ScreenStats` → `ScreenStat` ×2 — the percentage and the result count
  - `ScreenNote` — the current step, `tone="gap"` on a failed task
- `ScreenGroup` *What it has produced*, counted
  - `ScreenList` → `ScreenItem` ×n, or `ScreenEmpty`

### Props

The percentage's label is *Done so far* while running and *Complete* once it has
stopped, so a stalled figure never reads as a finished one. Each result takes
`meta` the resource it landed in.

### Behavior

**Results appear as they are found, not at the end.** That is what the empty
state says while the task is running, and it is why the region is a list rather
than a summary. Selecting one opens
[the result's lens](../../inspector/agents/task-results.md).

## Chat

Steering, interleaved with the agent's own progress notes.

**Example** — Grid Analyst — "I stopped because the table changed shape." — 4 min
ago; You — "Then draft around it." — just now

### Structure

- `ScreenGroup` *Steer it*
  - `ScreenList` → `ScreenItem` ×n — one per turn, with a `User` or `Bot` lead
  - `ScreenComposer` — the field, its send, and a `scope` snippet

### Props

The composer takes `label`, `placeholder` — "Change what it is doing" while
running, "This task has stopped" otherwise — `sendLabel`, a bound `value` and
`onsend`.

### Behavior

**The chat steers rather than converses.** Its turns are interleaved with the
agent's progress notes, because "I stopped because the table changed shape" and
"then draft around it" are one conversation, and splitting them into a log and a
chat makes the reader reconstruct the order.

Sending appends the turn locally and clears the field. Nothing is dispatched —
there is no agent capability — and the composer's scope line says so rather than
letting an unanswered message look like a failure.
