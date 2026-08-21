# Using a template

| Selecting | What it is | Sections |
| --- | --- | --- |
| **Use** on a template | What will be made, and what has to be supplied first | Makes · Asks you for · Generated on open · Create |

The instantiation form. One durable action at the end of it.

## Layout

| 300px |
| --- |
| makes |
| asks you for |
| asks you for |
| generated on open |
| create |

## Makes

What you will get and where it will go, before anything is asked.

**Shows** — `A · Document`, `Called · Q4 Filing Draft`, `In · Northwind Grid
Resilience`

**Needs** — the template's target kind, an editable name, and the destination
project.

## Asks you for

Every required variable, with its current state.

**Shows** — `filingDocket` — Not set; `filingParty` — Not set; `outageTable` — Not set

**Needs** — the variable list, and an editor per type — text, image, table.

**Open** — a table variable needs a picker over project variables, an upload, or
both. Nothing describes that yet.

## Generated on open

Variables that are not questions. Starts collapsed.

**Shows** — `execSummary` — Becomes a prompt block

**Needs** — generated-variable handling at instantiation.

## Create

One durable action. The result records where it came from and nothing else —
later template edits never mutate it.

**Shows** — **Create**, disabled.

**Open** — blocked on the same gap as everything else here: with no variable key
on a body entity, there is nowhere for a supplied value to go.
