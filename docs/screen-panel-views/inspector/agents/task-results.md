# A task result

| Selecting … | What it is | Sections |
| --- | --- | --- |
| One thing a task produced — on the task centre, or in a task lens | What it found, where it landed, and what else came out of the same run | Crumbs · Actions · What it found · Landed in · Where · From the same run |

**A result names where it landed, or says it landed nowhere.** That is the whole
difference between a finding an agent wrote into a resource and one it only
reported, and it is the first thing anyone checking the work needs to know — so
it is a field rather than a sentence in the detail.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.selection` | Model | which result is inspected |
| `capabilities.agents.tasksIn` · `resultsOf` | Capability | which task holds it, and its siblings |
| `capabilities.agents.task` | Capability | the owning task's title, for the trail and the *From* field |
| `resultId` | Prop | which result, where a caller already knows |

The project is not among them. It is read from `/app/[project]` once and carried
on the client model, so a panel that took it would be offering a second answer to
a question already settled.

## Layout

| Label | Components |
| --- | --- |
| crumbs | `PanelCrumbs` |
| actions | `PanelButton` ×2 |
| what it found | `PanelSection` |
| landed in | `PanelFields` |
| where | `PanelSection` |
| from the same run | `PanelSection` |
| | `PanelNote` |

*Where* is present only on a result that landed somewhere. A result that reported
only has nothing to open, and a row that opened nothing would be worse than no
row.

## Crumbs

The task, then *Results*.

**Example** — Reconcile feeder 12 outage minutes › Results

### Structure

- `PanelCrumbs` — the owning task, keyed to [its lens](task.md), then a plain
  final segment

## Actions

The two judgments a person makes about a result.

**Example** — **Keep** · **Reject**

### Structure

- `PanelButton` `tone="primary"` — **Keep**
- `PanelButton` — **Reject**

### Behavior

Neither records anything. A result has no accepted state in the model, which the
note at the foot says — because a Keep that silently did nothing is worse than
one that admits it.

## What it found

The detail, in full.

**Example** — "The relay log disagrees with the outage report by 1,800
customer-minutes across the two events."

### Structure

- `PanelSection` — titled *What it found*, holding the detail

### Behavior

Never truncated. This is the thing the lens is about, and a result whose sentence
is clipped makes the reader open the task to find out what was found.

## Landed in

Where it went, and which run it came out of.

**Example** — Landed in `Outage Cost Model` · From "Reconcile feeder 12 outage
minutes"

### Structure

- `PanelFields` — two fields

### Props

*Landed in* reads "Nowhere — reported only" where the result wrote nothing. The
absence is stated rather than left blank: an empty field reads as missing data,
and this is a fact.

## Where

The resource itself.

**Example** — `Outage Cost Model`

### Structure

- `PanelSection` `flush` — titled *Where*
  - `PanelRow` — the resource, with an external-link glyph

### Behavior

Selecting opens [the resource](../project/resource.md).

## From the same run

The other results of the same task.

**Example** — "Both events traced to the same fault" — "Relay timestamps are
within 40 s"

### Structure

- `PanelSection` `flush` — titled *From the same run*, counted excluding this one
  - `PanelRow` ×n
  - `PanelNote` — "This was the only one."
- `PanelNote` `tone="gap"` — that Keep and Reject record nothing

### Behavior

**Results are read against each other.** Three lines saying the same thing three
ways is a different situation from three lines saying three things, and that
comparison is impossible from a lens that shows one result alone.

Selecting a sibling replaces this lens with that one, keeping the trail.
