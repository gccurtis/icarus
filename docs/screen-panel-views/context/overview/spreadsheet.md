# Overview

| View | What it is for | Sections |
| --- | --- | --- |
| Overview | The spreadsheet as a whole | This spreadsheet · Calculation · Saved · From template |

Where the spreadsheet's identity lives now that there is no header bar and no
name box.

## Layout

| 300px |
| --- |
| this spreadsheet |
| this spreadsheet |
| calculation |
| saved |
| from template |

## This spreadsheet

Title, editable, and the two facts that describe the extent of the data.

**Shows** — `Title · Outage Cost Model`, `Used range · A1:G6`, `Populated cells · 42`

The used range and the populated count are both useful because the grid is
sparse: a used range of A1:G6 with 42 populated cells is a different object from
one with 4,000.

**Needs** — the spreadsheet record, its computed extent, and a count of persisted
cell blocks.

## Calculation

Whether the values on screen are current.

**Shows** — `Up to date`

Every formula reads its inputs when it runs, so there is no cached result to fall
behind. This section exists to say that, not to offer a recalculate.

**Needs** — the calculation engine's state.

## Saved

**Shows** — `All changes saved`

**Needs** — the editor's sync state, in the shell's shared save language.

## From template

Provenance only. Starts collapsed.

**Shows** — `Template · Cost model skeleton`

**Needs** — a template origin reference.
