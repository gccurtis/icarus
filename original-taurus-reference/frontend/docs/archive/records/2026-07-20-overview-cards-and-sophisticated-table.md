# Change record — 2026-07-20 — Overview: create cards + Notion-style table

Reworks the Overview stage: a row of per-type create cards above the resource
table, and a more sophisticated (Notion-inspired) table with multi-field filters and
sorting.

## Create cards

```svelte
<!-- OverviewStage: a "Create" section with a card per NEW_KINDS type. -->
```

**Why:** creating a resource should be prominent and per-type. **Purpose/why this
way:** a card row (document / spreadsheet / slides / chat / board), each an icon +
"New <type>"; clicking creates that resource and opens it as a tab. Replaces the
"New" dropdown.

## Sophisticated resource table

```svelte
<!-- ResourceTable: Filter menu (Type/Name conditions as chips) + sortable columns +
     search; ANDed conditions; sort by Name/Type/Updated. -->
```

**Why:** the table should support filtering on many fields and sorting, like Notion.
**Purpose:** add multiple filter conditions (Type is/is-not a kind; Name
contains/doesn't), sort by clicking any column header (toggling direction), and
search. **Why this way:** extracted into `ResourceTable.svelte` (reads the resources
store, emits open/download/remove) so the Overview stage stays a thin composition;
conditions AND together; empty/no-match states are explicit. The simple kind pills
were replaced by the richer filter builder.
