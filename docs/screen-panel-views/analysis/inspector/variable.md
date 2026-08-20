# A variable, in Analysis

| Selecting | What it is | Sections |
| --- | --- | --- |
| A variable in the Variables view | A table or value: what is in it, how it relates to others, and where to put it | Variable · Value · Relates to · Use |

The Analysis variant of the [shared variable lens](../../_shared/inspector/variable.md).
It drops the authoring detail — lookup key, order — and adds the one thing only
this screen cares about: how this variable lines up with the others.

## Layout

| 300px |
| --- |
| variable |
| value |
| value |
| relates to |
| use |

## Variable

**Shows** — `Name · outageEvents`, `Type · table`, `Rows · 4,182`

**Needs** — the variable record and its shape.

## Value

The first rows, with a count.

**Shows** — three rows of `eventId / subId / customerMinutes`, then "3 of 4,182 rows".

**Needs** — a bounded, server-side prefix of the value.

## Relates to

How this variable lines up with the others in play, and which relationship the
current chart is using.

**Shows** — *substations · subId → id* — Used by this chart

**Needs** — key inference between variables.

**Open** — automatic relationship discovery needs a real key-inference contract.
Without one, "they line up on `subId → id`" is a guess presented as a fact, and
the chart it produces is silently wrong when the guess is wrong.

## Use

**Put on X**, **Put on Y** — the keyboard path to what dragging does.

**Open** — putting a *table* on an axis is not meaningful; a field is. Either these
buttons act on a selected field, or they are only on field rows.
