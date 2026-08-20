# A variable in a template

| Selecting | What it is | Sections |
| --- | --- | --- |
| A variable, from the library card or the Variables view | One thing the template will ask for | Variable · Default · Where it appears |

## Layout

| 300px |
| --- |
| variable |
| variable |
| default |
| where it appears |

## Variable

The key, the label shown to whoever fills it in, what it asks for, and whether it
can be skipped.

**Shows**

| | |
| --- | --- |
| Key | `filingDocket` |
| Label | Docket number |
| Asks for | **Text** · Image · Table · Generated |
| Required | on |

The key is what the body would reference; the label is what a person reads. Both
are needed and they are not the same.

**Needs** — the template's variable record.

## Default

A value used when none is supplied. Starts collapsed.

**Shows** — `Value · —`

**Needs** — a default on the variable.

**Open** — `TemplateSlot.default` is always a string, which is unclear for an
image variable and meaningless for a table one.

## Where it appears

**Open** — cannot highlight it in the body or jump to it. Placement must not be
inferred from labels, text, array position or prompt content — every one of those
is a guess that will be wrong. One explicit mechanism has to exist first.
