# A project variable

| Selecting | What it is | Sections |
| --- | --- | --- |
| A variable, from the Variables view or from a formula that refers to it | One named value: how it is written, what type it is, and what it currently holds | Variable · Value · Use · Attribution |

The same lens wherever a variable is reached — the Variables panel, a formula in
a document, a cell that refers to one. Analysis substitutes a variant that adds
the relationships a chart needs; see
[analysis/inspector/variable.md](../../analysis/inspector/variable.md).

## Layout

| 300px |
| --- |
| variable |
| value |
| value |
| use |
| attribution |

## Variable

How it is written, how it is looked up, and where it sits in the list. The
authored name and the lookup key are shown separately because they differ, and
because a formula that fails usually failed on the key.

**Shows**

| | |
| --- | --- |
| Authored | `outageEvents` |
| Lookup key | `outageevents` |
| Type | table |
| Order | 1 of 9 |

**Needs** — the variable record: authored name, normalised key, type, position.

## Value

What it holds right now. A table shows its first rows with a count underneath; a
scalar shows itself.

**Shows** — three rows of `eventId / subId / customerMinutes`, then "3 of 4,182 rows".

**Needs** — the stored value, and a way to read a bounded prefix of a large one.

**Open** — the prefix has to be server-side for a 4,182-row table. Sending the
whole value to draw three rows is not acceptable.

## Use

The two things you actually want from here: put it in a formula, or chart it.

**Shows** — **Insert into formula** · **Use in Analysis**

**Needs** — insertion into whatever editor is focused, and a route to the
Analysis singleton that lands the variable on an axis.

## Attribution

Who made it and when it last changed. Starts collapsed.

**Shows** — `Created by · Mira Jain`, `Updated · 2 days ago`

**Needs** — creator actor and update timestamp on the variable record.
