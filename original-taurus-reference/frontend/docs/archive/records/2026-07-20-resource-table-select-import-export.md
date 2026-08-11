# Change record — 2026-07-20 — Resource table: alignment, multi-select, import/export

Tightens the resource table's columns and adds the affordances the user asked for:
an import button, shift-click multi-select, and bulk export — with mock modals.

## Column alignment

```svelte
const gridCols =
  'grid-cols-[1.75rem_minmax(0,1fr)_6.5rem_4.25rem] sm:grid-cols-[1.75rem_minmax(0,1fr)_6.5rem_6.5rem_4.25rem]';
```

**Why:** the Type pill had extra side gap, and Updated sat far from the download button
with a big gap. **How:** the shared column template gets snugger, explicit widths and a
tighter `gap-3`. The **Type** column is `6.5rem` with the badge now `w-full` (fills the
column — no side gap, "Spreadsheet" takes most of the space). **Updated** is
right-aligned (`justify-self-end` / `text-right`) so it sits next to the actions instead
of leaving a gap. Actions stay snug + right-aligned.

## Import button + modal (mock)

```svelte
<button aria-label="Import" onclick={() => (importOpen = true)}><Plus/></button>
<ImportDialog bind:open={importOpen} {onimport} />
```

**Why:** the table needs a quick add/import affordance. **How:** a `Plus` button next to
**Name** opens a new [`ImportDialog`](../../../src/lib/features/stages/ImportDialog.svelte)
(pick or drag-drop a file → Import), **badged Mock** — it adds the file as a `general`
resource. `ResourceTable` gained an `onimport` prop; Overview opens the imported
resource in a new tab, the New-tab launcher resolves its tab into it.

## Multi-select + bulk export (mock)

```svelte
<input type="checkbox" onclick={(e) => toggleRow(e, r.id, i)} />   <!-- shift-click = range -->
{#if selected.size > 0}<div class="selection bar">… Export … Clear</div>{/if}
<ExportDialog bind:open={exportOpen} count={selected.size} onconfirm={doExport} />
```

**Why:** the user wants to select and download several resources at once. **How:** a
leading **checkbox column** (shown on row hover / when checked) with **shift-click range
select** and a header **select-all**; when anything is checked, a **selection bar**
appears with an **Export** button that opens a new
[`ExportDialog`](../../../src/lib/features/stages/ExportDialog.svelte) (format picker,
**Mock**) and downloads each selected resource via the existing per-row `ondownload`.
Selected rows tint `bg-action/5`.
