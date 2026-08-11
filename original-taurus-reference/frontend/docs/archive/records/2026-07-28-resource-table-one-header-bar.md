# 2026-07-28 — The resource table down to one header bar

The table had grown **three stacked bars**: a toolbar (Import / Export / Filter / Search), the
column-header grid, and a conditional selection bar. The user's read: heavy, and the centre of
the header row is empty while controls pile up above and below it.

## Now one row

The four table-level controls moved **into the flexible Name cell**, right-aligned
(`ml-auto`), which lands them visually centred between "Name" and "Updated" — the dead space
that prompted this. Select-all, Name, and Updated all stay exactly where they were.

## The selection bar is deleted, and nothing was lost

Each of its three pieces was redundant:

- **Bulk Export** duplicated the Export already in the bar. `doExport` falls back to all
  visible rows when nothing is checked, so the single button already served both cases.
- **Clear** duplicated re-clicking the select-all checkbox — `toggleAll` clears when everything
  is selected.
- **"N selected"** was the only non-redundant part, and it did not justify a bar of its own. It
  is now an inline `text-action` count beside the Name header.

## History, so the layout is not re-litigated

These controls have been in three places. They started **inside the header grid's last cell** —
which is sized for a row's two icon buttons (4.25rem) — where four controls overflowed and
painted on top of the "Updated" header. They were then given **their own row**, which fixed the
overlap but cost a bar. They now sit in the Name column, which fixes both. The source carries a
comment saying so.

## Verification

`pnpm check` 0/0 · vitest **359/359** · build clean · companion OK · e2e **20/20**. The
select-all state was checked visually: one bar, "2 selected" inline, no Clear button.
