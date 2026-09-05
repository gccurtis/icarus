# Variables

| View | What it is for | Sections |
| --- | --- | --- |
| Variables | What can be charted, with each table's fields expanded underneath it | Tables · Values · Functions |

The same project variables as everywhere else, shown differently: here you are
picking a *field*, not referring to a name, so the fields have to be visible.

## Layout

| 300px |
| --- |
| search |
| tables |
| tables |
| tables |
| values |
| functions |

## Tables

Each table with its fields nested underneath, each field with its type. The type
is what decides where a field can go.

**Shows**

- **outageEvents** — 4,182 rows
  - `eventId` — text
  - `subId` — text
  - `eventDate` — date
  - `customerMinutes` — number
- **substations** — 41 rows
  - `id` — text
  - `name` — text
  - `undergroundPct` — number

**Needs** — per-variable field lists with inferred types.

**Open** — field types come from inspecting a heterogeneous table value. A column
that is mostly numbers with three strings in it has no single type, and the panel
currently shows one anyway.

## Values

Scalars. They can be charted as a reference line or used in a filter, not dropped
on an axis.

**Shows** — `hardeningBudget` — number; `filingDeadline` — date

**Needs** — name, type and value.

**Open** — what a scalar actually does when dropped is undefined. It should either
be undraggable or have a defined result.

## Functions

Visible but never inputs — a function is not a value and cannot be charted.
Starts collapsed.

**Shows** — `avoidedMinutes(t)` — not a chart input

**Needs** — the function list.

## Panel furniture

A search over variables, and the note that every drop zone also has an Add menu
and a keyboard path — nothing here is drag-only.
