# Personas — panels

A profile for each agent: who it is, what it has done, how it behaves, what it
can look up and what it may do. Background is prompt material; Context is
retrievable material — the screen never confuses the two.

Two subscreens: **all personas** and **one persona**. The rail is the same in
both; only what it is describing changes.

If the object is later renamed to Agent, the screen does not change shape.

## Context panel

| View | What it is for | Sections |
| --- | --- | --- |
| [Overview](context/overview.md) | This persona: who it is, what it has done, how it is set up | This persona · Record · Set up · Saved · Attribution |
| [Personas](context/personas.md) | Every agent available here, by scope | This project · Everywhere |
| [Work](context/work.md) | Everything it has done, by state | Running · Failed · Completed · Conversations |
| [Behaviour](context/behaviour.md) | The five sections of its definition | Sections |
| [Context](context/context.md) | What it can look up | It can look up · Contents |
| [Tools](context/tools.md) | What it may do, and which model runs it | Allowed · Not allowed · Model |

## Inspector panel

| Selecting | What it is | File |
| --- | --- | --- |
| A persona | The profile: picture, name, record, behaviour, scope and permissions | [persona.md](inspector/persona.md) |
| A task or conversation | One piece of work | [task.md](inspector/task.md) |
| A behaviour section | One of the five, what it is for, and what it costs | [behaviour-section.md](inspector/behaviour-section.md) |
| Its Context | What it can look up, and how that combines with a request | [what-it-can-look-up.md](inspector/what-it-can-look-up.md) |
| A tool | One permission | [tool.md](inspector/tool.md) |
| The model | Which binding runs it | [model.md](inspector/model.md) |
| An avatar or a "who" link | *shared* | [`_shared/inspector`](../_shared/inspector/) |

## Workspace

| State | What is in the centre | File |
| --- | --- | --- |
| All personas | Every agent, with what each has done on the card | [workspace-library.md](workspace-library.md) |
| One persona | The profile: who, then record, then behaviour beside scope and permissions | [workspace-profile.md](workspace-profile.md) |

## The rules this screen keeps

**Behaviour and Context are different things.** One is text sent on every call;
the other is material the agent can retrieve. They never share a panel.

**A record, not a configuration summary.** What an agent has done leads, because
that is what tells you whether to trust it.

**Empty behaviour sections are left out of the prompt entirely.** A persona with
five empty sections and a scope is legal.

**Provider credentials never appear here.** A model is a binding name.
