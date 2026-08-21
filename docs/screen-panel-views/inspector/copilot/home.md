# The Copilot, opened

| Selecting | What it is | Sections |
| --- | --- | --- |
| Opening the Copilot from the status bar | Everything in flight and everything recent, in one list | Waiting · Not working · Running · Recent conversations · Done |

The Copilot occupies the middle section of the status bar and rises straight out
of it. When it is open, this is what the inspector shows until you pick something
inside it.

The order is deliberate: what needs you, what is broken, what is moving, what you
were talking about, what is finished. State is said in words and icons, never in
colour alone.

Disabled entirely on Research, which is already a conversation with an agent.

## Layout

| 300px |
| --- |
| search |
| waiting |
| not working |
| running |
| recent conversations |
| recent conversations |
| done |

## Waiting

Tasks that have stopped and need something from a person.

**Shows** — *Confirm filing deadline* — Filing Editor · waiting

**Needs** — `AgentTask` in a waiting state.

**Open** — the task model does not record *why* a task is waiting or who can
unblock it, so the row says only "Waiting". No Reply or Resume affordance can be
offered until it does.

## Not working

Tasks that failed, with the reason on the row rather than behind a click.

**Shows** — *Rebuild substation crosswalk* — Grid Analyst · tool not permitted

**Needs** — a failure state and a human-readable reason on `AgentTask`.

## Running

Live work with its progress.

**Shows** — *Summarise overnight outage reports* — Grid Analyst · step 3 of 5

**Needs** — running state plus current step and step count.

## Recent conversations

Threads with agents, most recent first.

**Shows** — *Relay coordination history* — Grid Analyst · 2h

**Needs** — `PersonaChat` threads for this project, with the agent and a last-activity time.

## Done

Recently completed work. Starts collapsed — finished work is reference, not
attention.

**Shows** — *Extract 2024 storm precedents* — 2h

**Needs** — completed `AgentTask` records with a completion time.

## Panel furniture

A search across conversations and tasks, above the sections.
