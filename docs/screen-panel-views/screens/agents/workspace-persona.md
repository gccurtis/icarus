# Agents — one persona

| Workspace | What it is for | Regions |
| --- | --- | --- |
| Entered by opening a persona card | One agent: what it is, how it is defined, and what it is doing | Bar · Overview · Behaviour · Access · Tasks |

Three bands, in the order the questions come. Who is this and how is it doing;
then how it is defined; then, at the bottom, the work itself — because the work
is the band you scroll to and the definition is the band you edit.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.active.focus` | Model | which persona this is |
| `capabilities.agents.persona` | Capability | the `PersonaProfile`: name, description, scope, revision, author, record |
| `capabilities.agents.behaviourOf` | Capability | the five `BehaviourSection`s, written or empty |
| `capabilities.agents.lookupScopeOf` | Capability | the `LookupScope`: what it contains, how much is searchable, whether it travels |
| `capabilities.agents.toolsFor` | Capability | a `ToolPermission` per tool, allowed or not |
| `capabilities.agents.tasksIn` | Capability | every task in the project, narrowed here to this persona's |

The project is not among them. It is read from `/app/[project]` once and carried
on the client model, so a workspace that took it would be offering a second
answer to a question already settled.

## Layout

| 3fr | 2fr |
| --- | --- |
| bar | bar |
| overview | overview |
| behaviour | access |
| tasks | tasks |

Two tracks for the definition band and one for everything else: behaviour is
prose and wants the measure; access is a short list of grants and does not. Below
64rem the four bands stack in the order above.

## Bar

Which persona, and the way back.

**Example** — ← **All agents** · "Grid Analyst" · `Project` `Revision 6`

### Structure

- `ScreenBar` — title, back, and a `meta` snippet
  - `PanelChip` ×2 — the scope, then the revision

### Props

`title` the persona's name, `backLabel` "All agents", `onback`. The scope chip is
`tone="neutral"`: Project, Shared and Personal are three answers to one question
and colouring one of them would rank them.

### Behavior

Back calls `showSubscreen("library")`. It is the only way out, and it is here
rather than in the context panel because choosing which persona and choosing to
edit one are the same act — so returning is the reverse of that act rather than a
separate navigation.

## Overview

Identity and record together. Two personas with similar prose are told apart by
what they have done, so the counts sit beside the description rather than behind
a tab.

**Example** — a face, "Reads field data and relay logs; refuses to speculate past
the record.", "Built by Ana Reyes · changed 3 days ago", then `2` Running · `39`
Completed · `1` Failed · `14` Findings · `6` Conversations

### Structure

- `PanelActor` `kind="agent"` `size="face"` — the picture, beside the prose
- `ScreenStats` — labelled *What it has done*
  - `ScreenStat` ×5 — running, completed, failed, findings, conversations

### Props

Running is `tone="attention"` and failed `tone="danger"`; the other three are
plain. Only the two that are a call on your time are toned, because five toned
figures is a dashboard rather than a record.

## Behaviour

The five sections of the definition, listed rather than expanded.

**Example** — *Focus* — "Outage causation on the distribution network." — `212
chars`; *Verification* — its purpose in grey, `empty`

### Structure

- `ScreenGroup` — labelled *Behaviour*, counted *n of 5 written*
  - `ScreenList` → `ScreenItem` ×5 — one per section, in the definition's order

### Props

Each `ScreenItem` takes `title` the section name, `excerpt` its text — or its
*purpose* where the text is empty, so an unwritten section teaches what it is
for — `meta` the character count or the word `empty`, `selected` and `onselect`.

### Behavior

**Nothing here expands in place.** A behaviour section is 400 characters of prose
and does not fit between two other bands, so selecting one opens
[its lens](../../inspector/agents/behaviour-section.md).

An empty section is left in the list and left out of the prompt. A persona with
five empty sections and a scope is legal, and the list is where that is visible.

## Access

What it can look up, and what it may do — two different grants, in two groups.
Confusing them is how an agent ends up able to write where it was only meant to
read.

**Example** — *Can look up*: "Field reports 2024–25" — "180 of 240 searchable ·
Relay logs, Outage reports" — `this project`. *Tools*: "Search the lattice" —
`allowed`; "Write into a document" — `off`

### Structure

- `ScreenGroup` `tone="intelligence"` — *Can look up*, one `ScreenItem` for the
  scope, with a `Boxes` lead
- `ScreenGroup` — *Tools*, counted *n of m allowed*
  - `ScreenList` → `ScreenItem` ×n — one per permission, with a `Wrench` lead

### Props

The scope item takes `excerpt` "*searchable* of *contains* searchable" and the
first few members, and `meta` reading `travels` or `this project`. Each tool
takes `title` what it does — never the tool's identifier — and `meta` `allowed`
or `off`.

### Behavior

Selecting the scope opens
[what it can look up](../../inspector/agents/what-it-can-look-up.md); selecting a
tool opens [that permission](../../inspector/agents/tool.md). A permission is a
decision, so it is granted in a lens with the consequence written next to it
rather than by a switch in a list.

## Tasks

What this persona is managing, as a table.

**Example**

| Task | Started by | Running for | Results | State |
| --- | --- | --- | --- | --- |
| Reconcile feeder 12 outage minutes | Ana Reyes | 12 min | 3 | `running` |
| Nightly digest — 14 Nov | Ana Reyes · Automation | 9 h | 7 | `completed` |

### Structure

- `ScreenGroup` — labelled *Tasks it is managing*, with a count
  - `ScreenTable` — five columns, or `ScreenEmpty` where the persona has none

### Props

*Running for* is derived from the task's sortable minutes rather than from its
display phrase, so the column sorts and reads in the same units. *Started by*
appends `· Automation` where a rule fired it, because who asked and what asked
are the same column.

### Behavior

Selecting a task name calls `showSubscreen("task", id)`. It navigates rather than
inspects: from a persona you are following the work, and the work has a centre.
