# Agents — one Automation

| Workspace | What it is for | Regions |
| --- | --- | --- |
| Entered by opening a rule | One Automation: the trigger, what it does, and what it has produced | Bar · Overview · Behaviour · Trigger · Runs |

An Automation is a task with a trigger, which is why this centre is a sibling of
the task centre rather than a screen of its own kind. Everything below the
details band is tasks — the ones this rule dispatched.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.active.focus` | Model | which rule this is |
| `capabilities.agents.automation` | Capability | the `AutomationRecord`: name, sentence, enabled, revision, author, last fire |
| `capabilities.agents.triggersFor` | Capability | the five `TriggerOption`s, one of them chosen |
| `capabilities.agents.actionsFor` | Capability | the two `ActionOption`s, one of them chosen |
| `capabilities.agents.personasIn` | Capability | the persona named by an *Ask an agent* action |
| `capabilities.agents.tasksIn` | Capability | every task in the project, narrowed here to the ones this rule fired |
| local switch state | Prop | whether it is on, because no capability writes a rule back |

The project is not among them. It is read from `/app/[project]` once and carried
on the client model, so a workspace that took it would be offering a second
answer to a question already settled.

## Layout

| 3fr | 2fr |
| --- | --- |
| bar | bar |
| overview | overview |
| behaviour | trigger |
| runs | runs |

**Behaviour left, trigger right.** What it does is the part someone writes and
rewrites; when it happens is the part they set once and check. The setting goes
on the side the eye returns to less often. Below 64rem the trigger comes first,
because on a narrow screen a rule is identified by when it fires.

## Bar

Which rule, whether it is on, and the way back.

**Example** — ← **All agents** · "Nightly digest" · `On` `Revision 4` ·
[Enabled ▮] · **Run now**

### Structure

- `ScreenBar` — title, back, a `meta` snippet and an `actions` snippet
  - `PanelChip` — `On` `tone="active"` or `Off` `tone="neutral"`
  - `PanelChip` — the revision
  - `Switch` — **Enabled**
  - `Button` — **Run now**

### Behavior

**On and off is on the bar, not buried in the trigger.** It is the one control
anybody reaches for in a hurry, and a rule that is off says so where its name is.
The chip and the switch say the same thing twice on purpose: the chip survives
being read past, the switch is what you press.

The switch is held locally. Nothing writes a rule back, and a switch that
snapped back would be worse than one that admits it is a draft.

**Run now** fires the rule once, out of band, and lands on the task it makes —
`showSubscreen("task", id)` on the run it just started. It is on the bar rather
than in the trigger list because running a rule deliberately is not a sixth
trigger: *Only when I say* is the rule that never fires on its own, and **Run
now** is what you press regardless of which of the five is chosen. Nothing
dispatches a rule yet, so the built button has no run to land on.

## Overview

The rule as one sentence, then its record.

**Example** — "**When** the SharePoint connector syncs, **then** ask Grid Analyst
to summarise what changed." — a Grid Analyst face, "Last fired 9 h ago ·
started", "Built by Ana Reyes" — then `~180` Times fired · `41` Completed · `2`
Failed

**Nests** — the last-fire note, present only where the last firing has a reason
worth stating

### Structure

- a paragraph in the two clauses the model stores — `triggerClause` and
  `actionClause`, with *When* and *then* in muted ink
- `PanelActor` `size="row"` in a button — the persona, on an *Ask an agent* rule
- the last fire and the author, as caption lines
- `ScreenStats` → `ScreenStat` ×3 — times fired, completed, failed
- `ScreenNote` `tone="gap"` — why the last firing did not start, where there is
  one

### Props

Failed is `tone="danger"` only when it is non-zero, so a clean rule does not
carry a red figure for a thing that has not happened.

### Behavior

**The sentence is read before any of the configuration below it**, because the
configuration is only legible once you know which sentence it is building. It is
composed from the two stored clauses rather than written as prose, so it cannot
drift from what the rule actually does.

## Behaviour

The two things a rule can do, with the chosen one marked.

**Example** — *Ask an agent* — "Summarise what changed and post it to the project
feed." — `chosen`; *Re-run a generated block* — "Refresh a prompt block in a
document"

### Structure

- `ScreenGroup` *What it does*
  - `ScreenList` → `ScreenItem` ×2 — one per action kind, with a `Bot` lead

### Props

The chosen *Ask an agent* item shows its prompt as the excerpt and the others
their blurb — the prompt is the thing that gets rewritten, and it is only real on
the option actually in force.

### Behavior

Selecting opens
[the action's lens](../../inspector/agents/agent-action.md), or
[the refresh action's](../../inspector/agents/refresh-action.md). Both are listed
always rather than one being shown and the other hidden, because switching
between them is the act this region exists for.

## Trigger

The five things that can start a rule, with the chosen one marked.

**Example** — *A connector syncs* — "When a connector finishes a sync" —
`chosen`; *On a schedule*; *Something changes*; *A finding is accepted*; *Only
when I say*

### Structure

- `ScreenGroup` `tone="intelligence"` — *When it happens*
  - `ScreenList` → `ScreenItem` ×5 — one per trigger kind, with a `Clock` lead

### Behavior

Selecting opens [the trigger lens](../../inspector/agents/trigger.md), which is
one lens for all five kinds: they are alternatives to one another, so the
interesting act is switching between them and a lens per kind would make that act
a navigation.

*Only when I say* is a real trigger rather than the absence of one. A rule that
never fires on its own is a saved action you run deliberately, and calling that
"no trigger" is how it ends up looking broken in a health list.

## Runs

Every task this rule fired.

**Example**

| Run | Persona | Started | Results | State |
| --- | --- | --- | --- | --- |
| Nightly digest — 14 Nov | Grid Analyst | 9 h ago | 7 | `completed` |
| Nightly digest — 13 Nov | Grid Analyst | 1 d ago | 6 | `completed` |

### Structure

- `ScreenGroup` *Previous runs*, counted
  - `ScreenTable` — five columns, or `ScreenEmpty`

### Behavior

Selecting a run calls `showSubscreen("task", id)`. The rule keeps only its last
fire; a run becomes a task, and a task is what carries the results — which is
what the empty state says rather than claiming the rule has never fired.
