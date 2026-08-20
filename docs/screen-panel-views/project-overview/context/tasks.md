# Tasks

| View | What it is for | Sections |
| --- | --- | --- |
| Tasks | Agent work in this project, grouped by state | Waiting · Running · Failed · Recently completed |

The same task rows the Copilot shows, at project scope rather than in the bar.
Every row opens the [shared task lens](../../_shared/inspector/copilot-task.md).

The order is by what needs you first, not by time.

## Layout

| 300px |
| --- |
| waiting |
| running |
| failed |
| recently completed |
| footer |

## Waiting

Work that has stopped and needs a person.

**Shows** — *Confirm filing deadline* — Filing Editor · waiting

**Needs** — `AgentTask` in a waiting state.

**Open** — an unqualified waiting status says only "Waiting". No Reply or Resume
appears until the task model records why it is blocked and who can unblock it.

## Running

**Shows** — *Summarise overnight outage reports* — Grid Analyst · step 3 of 5

**Needs** — running state with step and step count.

## Failed

**Shows** — *Rebuild substation crosswalk* — Grid Analyst · tool error

**Needs** — failure state and a reason.

## Recently completed

Starts collapsed.

**Shows** — *Extract 2024 storm precedents* — 2h, *Draft board talking points* — 1d

**Needs** — completed tasks with a completion time.

**Open** — how far back "recently" reaches, and whether older completed tasks are
reachable from here at all or only from a Persona.

## Panel furniture

**Manage Personas** at the foot, going to the Personas tab.
