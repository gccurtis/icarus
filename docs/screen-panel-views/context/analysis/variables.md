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

Scalars normalize to a one-column, one-row table whose header is `Value`. They
can therefore use the same list-selection path as every other input; the chosen
chart grammar still decides whether that single value is meaningful in a slot.

**Shows** — `hardeningBudget` — number; `filingDeadline` — date

**Needs** — name, type and value.

## Functions

Visible as transformations, not unresolved data. A list selector may reference a
function whose lambda receives the normalized table and returns a list. An
unapplied function never reaches materialization. Starts collapsed.

**Shows** — `avoidedMinutes(t)` — table-to-list function

**Needs** — the function list.

## Panel furniture

A search over variables, and the note that every drop zone also has an Add menu
and a keyboard path — nothing here is drag-only.
