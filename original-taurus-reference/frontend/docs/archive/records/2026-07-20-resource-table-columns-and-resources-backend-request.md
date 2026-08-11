# Change record — 2026-07-20 — Aligned resource-table columns + resources backend request

Fixes the resource table's column alignment and files the backend request (and paired
discrepancy) for real project resources.

## Real, aligned table columns

```svelte
const gridCols =
  'grid-cols-[minmax(0,1fr)_8rem_5rem] sm:grid-cols-[minmax(0,1fr)_8rem_8rem_5rem]';
```

**Why:** the columns didn't line up — the grid used `auto` widths, so a longer relative
"updated" string widened its column, shrank the flexible Name column, and shifted the
Type badges row-to-row; the header (a separate grid) didn't align with the rows either.
**How:** the header and every row now share one **fixed** column template (`gridCols`):
`Name` flexes (`minmax(0,1fr)`), while Type / Updated / actions are explicit widths, so
every column lines up as a real column regardless of content. Within the columns, **Type
is centered** (header label + the `w-28` badge via `justify-self-center`) and the actions
cluster is right-aligned (`justify-self-end`) — header and rows match. Updated only
appears at `sm+`, so the template drops to three columns on narrow widths.

## Resources backend request + discrepancy

**Why:** project resources — the entire content of the Overview stage — are a
client-only `localStorage` mock with no backend at all; the user asked to capture the
"retrieve all resources" need. **How:** added
[backend-requests/resources.md](../backend-requests/resources.md) (list / create /
rename / delete resources per project, with a proposed API and the `ResourceKind` enum)
and the paired [discrepancies/resources.md](../../discrepancies/resources.md) (how the
mock works today, keyed by project in `localStorage`). Both READMEs now index them;
the request is marked **High** priority (it unblocks the whole table). No resource
endpoint existed before, so this is net-new documentation, not an update to an existing
request.
