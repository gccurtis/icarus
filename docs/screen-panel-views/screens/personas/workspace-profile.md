# Personas — one persona

| Workspace | What it is for | Regions |
| --- | --- | --- |
| Entered from Open, or Edit | A profile: who it is, what it has done, how it behaves, what it may see and do | Screen header · Profile · Record · How it behaves · What it can look up · What it may do · Everything it has done |

A profile, not a form. The order is deliberate: who, then what it has done, then
how it is configured — because a record is what tells you whether to trust an
agent, and configuration only matters once you do.

## Layout

| 3fr | 2fr |
| --- | --- |
| screen header | screen header |
| profile | profile |
| record | record |
| how it behaves | what it can look up |
| how it behaves | what it may do |
| how it behaves | what it may do |
| everything it has done | everything it has done |
| everything it has done | everything it has done |

## Screen header

**Shows** — **Back to library**, "Grid Analyst", `Saved · revision 14`

**Needs** — the persona record and its revision.

## Profile

Picture, name, description, and the three facts that qualify everything below.

**Shows** — a large avatar beside "Grid Analyst" and "Reads field data and relay
logs; refuses to speculate past the record.", then `This project`,
`analyst-default`, `4 tools`

**Needs** — the `Persona` record with an avatar field.

## Record

Four numbers, as stat blocks.

**Shows** — `41 tasks run` · `2 running now` · `1 failed` · `128 findings accepted`

*Failed* is included deliberately. A record that only counts successes is not a
record.

**Needs** — a per-persona aggregate over `AgentTask` and accepted `Finding`.

## How it behaves

The five definition sections as an accordion, the first open, each showing its
text.

**Shows** — Focus expanded with its text; Background, Approach, Output and
Verification collapsed, each marked "written"

Under it, one line: all of it is prompt text and costs context on every call —
what it can look things up in is separate, and beside it.

**Needs** — the persona's five definition fields.

## What it can look up

Retrievable material. The narrower right-hand column, directly opposite the prompt
material, so the distinction is spatial as well as stated.

**Shows** — *Field reports 2024–25* — 96 resources · not pasted into the prompt;
*The web* — Not allowed

The qualifier on the first row is the whole point: a scope is searched, not
included.

**Needs** — the persona's `ResourceSet` reference and its web permission.

## What it may do

Tool permissions, allowed and denied in one list so the denials are as visible as
the grants.

**Shows** — `lattice.retrieve` — Allowed; `resource.read` — Allowed;
`finding.create` — Allowed; `resource.write` — Not allowed

**Needs** — the persona's tool allowance against the tool catalogue.

## Everything it has done

The record in full, as a table, with tasks and conversations together — both are
work this agent did.

**Shows**

| Task | Started by | When | Result |
| --- | --- | --- | --- |
| Summarise overnight outage reports | Nightly filing digest | 02:00 | Running · 3 of 5 |
| Rebuild substation crosswalk | Ana Reyes | Yesterday | Failed · tool not permitted |
| Extract 2024 storm precedents | Ana Reyes | 2 hours ago | 14 findings accepted |
| Relay coordination history | Ana Reyes | 2 hours ago | Conversation · 14 turns |

*Started by* resolves through the shared actor lenses, so a task an Automation
dispatched is visibly different from one a person started.

**Needs** — `AgentTask` and `PersonaChat` for this persona, with dispatching
actors and per-task results.
