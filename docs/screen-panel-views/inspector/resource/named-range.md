# A named range

| Selecting | What it is | Sections |
| --- | --- | --- |
| A name in the Named ranges view | One name that means a range, inside this spreadsheet only | Name · Usage |

## Layout

| 300px |
| --- |
| name |
| usage |

## Name

**Shows** — `Name · costModel`, `Sheet · Cost model`, `Range · A1:G6`

**Needs** — the named-range record.

**Open** — the *Sheet* field is left over from when a spreadsheet was a workbook
of sheets. A spreadsheet is one grid now, so the field has nothing to say and
should go.

## Usage

Starts collapsed.

**Shows** — "Referenced by 3 formulas."

**Needs** — a scan of formulas referencing the name.

**Open** — renaming or deleting a name that formulas use needs a defined outcome.
Either references are rewritten, or they break to `#NAME?`, and the panel should
say which before the edit.
