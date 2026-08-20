# An agent

| Selecting | What it is | Sections |
| --- | --- | --- |
| An agent, wherever it is named as "who did this" | What it is for, what it has done, and how to give it work | Agent · Record · Doing now · No message · Actions |

The same object the Personas screen edits, seen from wherever it happened to be
named. This is a summary and a way in, not the editor.

If Persona is later renamed to Agent, nothing here changes.

## Layout

| 300px |
| --- |
| agent |
| record |
| doing now |
| no message |
| actions |

## Agent

Picture, name, scope, and one line on what it is for — taken from its own
definition rather than written twice.

**Shows** — `Grid Analyst · Persona · this project` — "Reads field data and relay logs; refuses to speculate past the record."

**Needs** — `Persona` name, avatar, description and scope.

## Record

What it has actually done, as three numbers. A record is more useful than a
configuration summary when you are asking "who is this".

**Shows** — `41 tasks · 2 running · 128 findings`

**Needs** — a per-persona aggregate over `AgentTask` and accepted `Finding`.

**Open** — no such aggregate exists. Counting these client-side does not scale
past the first page of tasks.

## Doing now

Its live work, each row opening the task.

**Shows** — *Summarise overnight outage reports* — Step 3 of 5

**Needs** — `AgentTask` filtered to this persona and to running states.

## No message

The absence, stated. An agent has no inbox: to give it work you start a task —
through the Copilot, or an Automation that asks it to do something.

Worth a section because the person lens directly above it in the same panel *does*
have a composer, and the difference should be explicit rather than felt as a
missing control.

**Needs** — nothing.

## Actions

**Open profile** goes to the Personas screen with this one selected. **Start a
task** opens the Copilot addressed to it.

**Needs** — navigation to the Personas singleton with a selection, and a Copilot
composer that can be opened pre-addressed.
