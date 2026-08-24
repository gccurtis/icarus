# Agents — panels

One screen, not two. An Automation is a task with a trigger and a persona is what
runs one, so Personas and Automations are not two subjects — they are one subject,
and splitting them across two screens would cut exactly where the interesting
question is: *what is this agent doing right now*.

Four centres: **library**, **persona**, **task** and **automation**. The library
is what the tab opens on; the other three are reached by choosing something —
double-clicking a persona card, opening a task row, following a rule — and left
by the back button on the `ScreenBar`. There is no switcher in the context panel.

A persona is Project, Shared or Personal. That is who may edit it, not where it
runs, and it is the first division on the library rather than a filter chip.

## Context panel — library

| View | What it is for | Sections |
| --- | --- | --- |
| [Overview](../../context/overview/agents.md) | What is running right now, and what is standing by | Actions · Right now · Running · Failed · Automations on |
| [Personas](../../context/agents/personas.md) | Every agent available here, by who owns it | Actions · Search · Project · Shared · Personal |
| [Tasks](../../context/agents/tasks.md) | Every task in this project, grouped by whether it needs you | Search · Persona · Running · Failed · Done |
| [Automations](../../context/agents/automations.md) | Every rule, by state | Not working · On · Off |

## Context panel — persona

| View | What it is for | Sections |
| --- | --- | --- |
| [Overview](../../context/overview/agents.md) | What is running right now, and what is standing by | Actions · Right now · Running · Failed · Automations on |
| [Personas](../../context/agents/personas.md) | Every agent available here, by who owns it | Actions · Search · Project · Shared · Personal |
| [Behaviour](../../context/agents/behaviour.md) | The five sections of the agent's definition | Sections |
| [Work](../../context/agents/work.md) | Everything this agent has done, by state | Running · Failed · Completed · Conversations |
| [Tools](../../context/agents/tools.md) | What this agent may do, and which model runs it | Allowed · Not allowed · Model |
| [Context](../../context/agents/context-persona.md) | What this agent can look up | It can look up · Contents |

## Context panel — task

| View | What it is for | Sections |
| --- | --- | --- |
| [Overview](../../context/overview/agents.md) | What is running right now, and what is standing by | Actions · Right now · Running · Failed · Automations on |
| [Tasks](../../context/agents/tasks.md) | Every task in this project, grouped by whether it needs you | Search · Persona · Running · Failed · Done |
| [Work](../../context/agents/work.md) | Everything this agent has done, by state | Running · Failed · Completed · Conversations |
| [Tools](../../context/agents/tools.md) | What this agent may do, and which model runs it | Allowed · Not allowed · Model |
| [Health](../../context/agents/health.md) | What is broken, what has never run, and what works | Not working · Never fired · Working |

## Context panel — automation

| View | What it is for | Sections |
| --- | --- | --- |
| [Overview](../../context/overview/agents.md) | What is running right now, and what is standing by | Actions · Right now · Running · Failed · Automations on |
| [Automations](../../context/agents/automations.md) | Every rule, by state | Not working · On · Off |
| [When](../../context/agents/when.md) | The five things that can start a rule | On a schedule · Something changes · A connector syncs · A finding is accepted · Only when I say |
| [Do this](../../context/agents/do-this.md) | The two things a rule can do | Ask an agent · Re-run a generated block |
| [Health](../../context/agents/health.md) | What is broken, what has never run, and what works | Not working · Never fired · Working |

**Overview is on all four rails.** This screen changes under you while you read
it — a task finishes while you are looking at a persona — so the figures that say
what is running have to be reachable from wherever you are.

## Inspector panel

| Selecting | What it is | File |
| --- | --- | --- |
| A persona card | The profile: picture, name, record, behaviour, scope and permissions | [persona.md](../../inspector/agents/persona.md) |
| A task row, from anywhere | What was asked, how far it got, what it produced | [task.md](../../inspector/agents/task.md) |
| A line of a task's configuration | What it was told, editable while it runs | [task-behaviour.md](../../inspector/agents/task-behaviour.md) |
| One thing a task produced | Where it landed, or that it landed nowhere | [task-results.md](../../inspector/agents/task-results.md) |
| A behaviour section | One of the five, what it is for, and what it costs | [behaviour-section.md](../../inspector/agents/behaviour-section.md) |
| Its Context | What it can look up, and how that combines with a request | [what-it-can-look-up.md](../../inspector/agents/what-it-can-look-up.md) |
| A tool | One permission | [tool.md](../../inspector/agents/tool.md) |
| The model | Which binding runs it | [model.md](../../inspector/agents/model.md) |
| An Automation | The rule itself: its sentence, its record, its state | [automation.md](../../inspector/agents/automation.md) |
| A trigger | What makes a rule fire, and the four it could fire on instead | [trigger.md](../../inspector/agents/trigger.md) |
| A schedule trigger | The clock detail behind *On a schedule* | [schedule-trigger.md](../../inspector/agents/schedule-trigger.md) |
| An *Ask an agent* action | The persona, the prompt, and what it is allowed to do | [agent-action.md](../../inspector/agents/agent-action.md) |
| A *Re-run a generated block* action | Which block, and what re-running it replaces | [refresh-action.md](../../inspector/agents/refresh-action.md) |
| A last fire | One firing: when, whether it started, and why not | [last-fired.md](../../inspector/agents/last-fired.md) |
| A person, or any "who" link | Their profile in this project | [person.md](../../inspector/collaboration/person.md) |

[task.md](../../inspector/agents/task.md) is the lens for a task wherever it is
named — a library row, a persona's work list, an Automation's run history. It is
one lens, and the step that follows it is a button rather than a scroll.

## Workspace

| State | What is in the centre | File |
| --- | --- | --- |
| Library | Every persona in reach, as folders and cards, over a table of every task | [workspace-library.md](workspace-library.md) |
| Persona | Who it is, how it is defined, and what it is doing | [workspace-persona.md](workspace-persona.md) |
| Task | What it was asked, how it is going, and how to steer it | [workspace-task.md](workspace-task.md) |
| Automation | The trigger, what it does, and what it has produced | [workspace-automation.md](workspace-automation.md) |

## The rules this screen keeps

**An Automation is a task with a trigger.** Its runs are tasks, and the task is
what carries the results. That is why the automation centre is a sibling of the
task centre rather than a screen of its own kind.

**Behaviour and Context are different things.** One is text sent on every call;
the other is material the agent can retrieve. They never share a panel.

**A record, not a configuration summary.** What an agent has done leads, because
that is what tells you whether to trust it.

**Tasks are a table, personas are cards.** An agent is recognised by its face and
its record; a task is read off a row against the rows above it.

**A single click selects, a double click opens.** Conflating them would mean you
could not look at a persona without leaving the list you were comparing it
against.

**Provider credentials never appear here.** A model is a binding name.
