# A task

| Selecting | What it is | Sections |
| --- | --- | --- |
| A task, from the Copilot, from Project Overview, from a Persona, or from an Automation's last fire | What was asked, who is doing it, the plan, and where it has got to | Task · Asked to · Plan · Tools used · Produced · Actions |

The same lens everywhere a task is named. A task is the unit of agent work and
its own whole trace.

## Layout

| 300px |
| --- |
| task |
| task |
| asked to |
| plan |
| plan |
| tools used |
| produced |
| actions |

## Task

State, progress, and the four facts that identify it.

**Shows**

| | |
| --- | --- |
| State | Running · step 3 of 5 |
| Title | Summarise overnight outage reports |
| Agent | Grid Analyst |
| Started by | Nightly filing digest |
| Started | 02:00 |

**Needs** — `AgentTask` state, title, persona, dispatching actor and start time.
*Started by* may be a person, an Automation, or another agent, and resolves
through the shared actor lenses.

## Asked to

The instruction, verbatim. It is immutable — changing what was asked means a new
task — and the panel says so.

**Shows** — "Summarise last night's outage reports by substation and flag
anything that changes the filing position."

**Needs** — the original prompt on `AgentTask`.

## Plan

The steps, each with its own state. This is the progress bar, spelled out.

**Shows**

- Resolve what it can look up — Done
- Read overnight reports — Done · 14 sources
- Group by substation — Active
- Flag filing-relevant changes — Pending
- Write the summary — Pending

**Needs** — an ordered step list with per-step state on `AgentTask`.

## Tools used

What it called and how long each took. Starts collapsed.

**Shows** — `lattice.retrieve · 1.4 s · 14 regions`, `resource.read · 0.3 s`

**Needs** — a tool-call record per task, with name, outcome and duration.

## Produced

What came out. A task result is not a resource: it has to be promoted into a
finding, a document, a deck or a spreadsheet before anything in the project can
retrieve it. Starts collapsed.

**Shows** — before promotion, the sentence above and nothing else.

**Needs** — links from a task to whatever it produced, and a promotion action per
target kind.

## Actions

**Follow** subscribes to it. **Cancel** stops it.

**Open** — Retry is absent rather than disabled. Retry semantics are not modeled,
and a button that might re-run a partly-completed task is worse than no button.
