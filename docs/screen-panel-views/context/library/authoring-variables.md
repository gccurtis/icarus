# Variables — one template

| View | What it is for | Sections |
| --- | --- | --- |
| Variables in this template | What this template will ask the person using it | Required · Optional |

The one panel that is particular to a template. Everything else in this subscreen
is the ordinary editor.

Split by requiredness, because that is what decides whether someone can get past
the instantiation form.

## Layout

| 300px |
| --- |
| actions |
| required |
| required |
| optional |

## Required

Variables that must be supplied.

**Shows** — `filingDocket` — Text; `filingParty` — Text; `outageTable` — Table

**Needs** — the template's variable list with key, type and requiredness.

## Optional

Variables that can be skipped — including generated ones, which are not questions
at all: they become prompt blocks in the result.

**Shows** — `execSummary` — Generated · becomes a prompt block

**Needs** — as above.

**Open** — a generated variable is optional in a different sense from a text one:
skipping it means the block is absent, not that a value is empty. Whether they
belong in the same section needs deciding.

## Panel furniture

**Add variable** in the action row.

**Open** — adding and listing work. Highlighting where a variable sits in the
body, and jumping to it, are disabled — nothing in a body records which variable
it stands for. That makes this panel a list with no connection to the document
beside it.
