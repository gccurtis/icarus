# Overview

| View | What it is for | Sections |
| --- | --- | --- |
| Overview | What an Automation is, what this project has, and what is selected | Automations · In this project · Selected · Actions |

## Layout

| 300px |
| --- |
| automations |
| in this project |
| selected |
| selected |
| selected |
| actions |

## Automations

The concept, in one sentence: a standing rule — when one thing happens, do one
other thing. Two triggers means two rules.

The constraint is the definition, so it is stated rather than discovered by
looking for a second trigger and not finding one.

**Needs** — nothing.

## In this project

Counts by state.

**Shows** — `Rules · 4`, `On · 3`, `Not working · 1`

**Needs** — project `Automation` records with enabled state and last-fire outcome.

## Selected

The current rule as its sentence, with its switch and its record.

**Shows** — `Name · Nightly filing digest`, then "**When** the clock reaches 02:00
in New York, **ask Filing Editor** to summarise last night's reports.", then
`On · yes`, `Last result · Couldn't start`, `Fired about · 184 times`

The sentence is generated from the trigger and action rather than typed. It is
how a rule is read everywhere on this screen.

**Needs** — the `Automation` record, and one renderer from trigger plus action to
a sentence.

**Open** — the fire count is approximate and must stay labelled as such.

## Actions

**Open** enters the rule subscreen. **Run now** dispatches using the saved
configuration.

**Needs** — a manual dispatch that uses the saved rule, not the edited one.
