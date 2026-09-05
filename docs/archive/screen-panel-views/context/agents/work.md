# Work

| View | What it is for | Sections |
| --- | --- | --- |
| Work | Everything this agent has done, by state | Running · Failed · Completed · Conversations |

The record, in full. It is a first-class panel rather than a footnote on the
profile, because what an agent has done is the main evidence about it.

## Layout

| 300px |
| --- |
| running |
| failed |
| completed |
| completed |
| conversations |

## Running

**Shows** — *Summarise overnight outage reports* — Step 3 of 5 · from Nightly
filing digest

Naming what started it matters: a task the agent began and a task an Automation
dispatched are different situations.

**Needs** — `AgentTask` in running states, with the dispatching actor.

## Failed

With the reason on the row.

**Shows** — *Rebuild substation crosswalk* — Tool not permitted: web.search

**Needs** — failure state and reason.

**Open** — "tool not permitted" is a configuration failure, not a runtime one, and
it is fixable from the Tools panel two rail entries away. A failure that names its
own fix should link to it.

## Completed

**Shows** — *Extract 2024 storm precedents* — 2h; *Draft board talking points* — 1d
· of 38

**Needs** — completed tasks with completion times.

## Conversations

Threads, alongside tasks, because both are work this agent did. Starts collapsed.

**Shows** — *Relay coordination history* — 2h; *Reading the 2024 study* — 1d · of 6

**Needs** — `PersonaChat` threads for this persona.
