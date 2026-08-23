# Two variables, no relationship

| Selecting | What it is | Sections |
| --- | --- | --- |
| The relationship notice above the chart | Two variables that need relating before a chart can be drawn, and the fix | Why you are seeing this · Currently matching on · Other ways they line up · Actions |

A relationship lens for either a dimension join or a bridge. It appears only
when two relation sets need composition. The compact screen can frame a missing
relationship as a problem to solve; the persisted definition still records the
chosen keys, join kind, sides, and order explicitly.

## Layout

| 300px |
| --- |
| why you are seeing this |
| currently matching on |
| currently matching on |
| other ways they line up |
| actions |

## Why you are seeing this

The situation, in plain words: these two fields live in different variables, and
a chart needs to know which rows belong together.

**Shows** — "**substations.name** and **outageEvents.customerMinutes** live in
different variables. A chart needs to know which rows belong together."

**Needs** — the two relation references and the identified source inputs behind
their join keys.

## Currently matching on

The match the system picked, and what happens to rows that do not match. The
second part is the one that changes the answer.

**Shows**

| | |
| --- | --- |
| Left | `outageEvents.subId` |
| Right | `substations.id` |
| Keep rows | **With a match** · All on the left · All on the right · All of both |

**Needs** — the chosen key pair and the join mode.

**Open** — the mode is presented in plain words rather than as inner/left/right/
full. That is right for reading and ambiguous for someone who knows the standard
names. Whether both appear is a review question.

## Other ways they line up

The alternatives, each with how well it matches — the number is what makes the
choice decidable.

**Shows** — `outageEvents.regionId → substations.regionId` — Matches 41 of 41 rows

**Needs** — candidate key pairs with match coverage.

**Open** — the same key-inference gap. A ranked list of guesses is more dangerous
than one guess, because it looks like analysis.

## Actions

**Use this**, **Match on something else**.
