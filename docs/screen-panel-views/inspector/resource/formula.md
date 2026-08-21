# An inline formula

| Selecting | What it is | Sections |
| --- | --- | --- |
| A formula inside running text | What it shows, the expression behind it, when it reads, and how it is formatted | Shows · Formula · Value · Format |

An inline formula is a piece of live text. In the document it reads as ordinary
prose — nothing about it pops out of the page — and everything you might want to
know about it is here instead.

## Layout

| 300px |
| --- |
| shows |
| formula |
| formula |
| value |
| format |

## Shows

The rendered result, as it appears in the sentence.

**Shows** — `$46.0M`

**Needs** — the evaluated value and the display format applied.

## Formula

The expression, editable, with a way to open whatever variable it refers to.

**Shows** — `=hardeningBudget`, with **Open variable**

**Needs** — the stored expression, and name resolution from it to a project
variable.

## Value

The type, and when it is read.

**Shows** — `Type · number`, `Read · on open, and on every change`

A formula reads its value when it runs, so what is on the page is what the
variable holds. There is no cached copy to fall behind, which is why nothing here
is ever marked stale and there is no refresh control.

**Needs** — the resolved type, and the evaluation trigger.

## Format

How the value is displayed. Starts collapsed.

**Shows** — `Display · $#,##0.0,,"M"`

**Needs** — a display format string on the formula.

**Open** — the format language is shared with the spreadsheet. It has to be one
language, or the same number formats differently in a document and a grid.
