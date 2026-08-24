# A trigger

| Selecting … | What it is | Sections |
| --- | --- | --- |
| A trigger, in the *When it happens* band of an Automation | What makes the rule fire, and the four it could fire on instead | Crumbs · Fires on · Or fire on |

**One lens for all five kinds, not five lenses.** They are alternatives to one
another, so the interesting act here is switching between them — and a lens per
kind would make that act a navigation. The chosen one's detail is the only thing
that varies, and it is one field.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.active.focus` | Model | which Automation, where the caller has not named one |
| `capabilities.agents.automation` | Capability | the rule's name and its last fire |
| `capabilities.agents.triggersFor` | Capability | the five `TriggerOption`s, one of them chosen, each with its own detail |
| `automationId` | Prop | which rule, where a caller already knows |

The project is not among them. It is read from `/app/[project]` once and carried
on the client model, so a panel that took it would be offering a second answer to
a question already settled.

## Layout

| Label | Components |
| --- | --- |
| crumbs | `PanelCrumbs` |
| fires on | `PanelFields` |
| | `PanelNote` |
| or fire on | `PanelSection` |
| | `PanelNote` |

The first note is the reason the last firing did not start, and is absent where
there is none.

## Crumbs

The rule, then *When*.

**Example** — Nightly digest › When

### Structure

- `PanelCrumbs` — the rule, keyed to [its lens](automation.md), then a plain
  segment

## Fires on

The chosen trigger, its detail, and its record.

**Example** — Fires on `A connector syncs` · Which "SharePoint — Ops Reports" ·
Last fired "9 h ago · Started" · Fired about ~180 times

### Structure

- `PanelFields`
  - `PanelChip` `tone="intelligence"` — the chosen kind
  - the varying detail, then the last fire and the count
- `PanelNote` `tone="gap"` — why the last firing did not start

### Props

**The detail is one field whose meaning depends on the kind**: a schedule's time,
zone and repeat; the resource a change is watched on; the connector; the question
a finding must be accepted against. *Only when I say* has none, and the field is
absent rather than empty.

### Behavior

*Fired about ~180 times* is approximate and says so. The rule keeps its last fire
and a rough count, not a run log — the runs are tasks, and
[the Automation centre](../../screens/agents/workspace-automation.md) lists them.

## Or fire on

The other four, so switching is one click rather than a trip to a menu.

**Example** — *On a schedule* — "Every weekday at 07:00"; *Something changes* —
"When a resource is edited"; *A connector syncs* — `chosen`; *A finding is
accepted* — "When a finding lands on a question"; *Only when I say* — "Runs when
you press Run now"

### Structure

- `PanelSection` `flush` — titled *Or fire on*, with a count
  - `PanelRow` ×5 — every kind including the chosen one, which is marked selected
- `PanelNote` `tone="gap"` — that choosing selects here and nothing more

### Behavior

**All five are listed, chosen one included.** A list of "the other four" would
make the current answer vanish from the place where the alternatives are compared
against it.

**`Only when I say` is a real trigger, not the absence of one.** A rule that never
fires on its own is a saved action you run deliberately, and calling that "no
trigger" is how it ends up looking broken in a health list.

Choosing one re-inspects this lens with that kind chosen. No capability writes a
rule back, so the choice is a statement about this session.
