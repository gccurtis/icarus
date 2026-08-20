# Variables

| View | What it is for | Sections |
| --- | --- | --- |
| Variables | The project's Name Manager — every named table, value and function, and the only place they are created | Tables · Values · Functions |

Anywhere a formula can be written, this is where you find out what a formula can
refer to. A variable is stored as a *value*, not as an expression: what this view
shows is exactly what a formula will get when it runs. That is why nothing here
is ever stale, and why no section carries a refresh.

Present on Project Overview, the document, deck and spreadsheet editors, and both
Analysis subscreens. Analysis shows the same variables with their fields expanded
underneath, because there you are dropping a field rather than referring to a
name — see [analysis/context/variables.md](../../analysis/context/variables.md).

## Layout

| 300px |
| --- |
| search |
| tables |
| tables |
| values |
| functions |
| footer |

## Tables

Named tabular values. The row and field counts are the useful thing at a glance —
they say whether a variable is the one you meant.

**Shows** — `outageEvents · 4,182 rows · 13 fields`, `substations · 41 rows · 8 fields`

**Needs** — the project variable store, with a resolved value and a shape summary
per name. Row and field counts must come from the stored value, not from a
schema declaration, because the value is the authority.

## Values

Scalars: numbers, dates, text. The current value is shown inline, because it is
short and because seeing it is the whole reason to look.

**Shows** — `hardeningBudget · number · 46,000,000`, `filingDeadline · date · 14 Nov 2026`, `filingParty · text · Northwind Power`

**Needs** — name, type, and current value per variable.

## Functions

Named transformations. They are listed because they can be called, but they are
not values and cannot be dropped anywhere a value is expected.

**Shows** — `avoidedMinutes(t) · table → table`, `costPerMinute(t) · table → number`

**Needs** — a signature, or at least an argument and return type, per function.

**Open** — a function's signature has to come from somewhere. If it can only be
inferred from the last call, the panel should say so rather than presenting it as
declared.

## Panel furniture

A search field across all three sections, and **New variable** at the foot. Both
are the panel's, not a section's.

**Open** — creating a variable needs a type picker and a value editor that
handles a table. Nothing in this view describes that yet.
