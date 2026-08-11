# src/lib/features/stages/shared/ResourceTable.svelte — breakdown

Companion to [ResourceTable.svelte](ResourceTable.svelte). A compact, Notion-inspired resource **list**: **one** header row does everything — it sorts (click Name/Updated) and carries the four table-level controls (search, filter, **download**, **import**) centred on the bar; rows are **multi-selectable** (shift-click for a range) for a bulk **download**. **Pinned** resources always sort to the top and show a pin indicator. The kind is shown by the colored icon (with a hover tooltip), not a Type column. Every row/header shares one fixed column template so the columns line up. It reads the resources store, **owns downloading itself** through the shared per-kind transfer table, and emits open/remove/import/rename through callbacks.

## Script: imports

### Import icons, utilities, UI components, the resources store, the transfer table, and the dialogs

```svelte
<script lang="ts">
  import type { Component } from 'svelte';
  import { Filter, Search, X, Plus, ArrowUp, ArrowDown, Check, Minus, FileInput, Download, MoreHorizontal, Pin } from '@lucide/svelte';
  import { cn, useId } from '$lib/utils';
  import { Input, Menu, Popover, EmptyState, toast, type Tone } from '$lib/components';
  import { iconTileClass } from '$data/projects';
  import { resources, RESOURCE_KINDS, type Resource, type ResourceKind } from '$data/resources';
  import { relativeTime } from '$data/time';
  import { exporterFor, exportFormats, unbuiltFormatMessage, type ExportFormat } from '$lib/features/shared/transfer';
  import ImportDialog from './ImportDialog.svelte';
  import ExportDialog from './ExportDialog.svelte';
  import ResourceSettingsDialog from './ResourceSettingsDialog.svelte';

```

The imports gather everything the table composes: the Lucide icons for the header controls, checkboxes, and row actions (`Download` serves both download surfaces, and Import is a `FileInput` rather than an `Upload` arrow — the header-button section explains why); the `cn` class-merge and `useId` helpers; the component-library primitives (`Popover`, `Menu`, `EmptyState`, etc.); `iconTileClass` for the tinted kind tile; the resources store plus `RESOURCE_KINDS` and the domain types; `relativeTime` to format timestamps; the shared per-kind transfer table (`exporterFor` for the exporter of a kind, `exportFormats` and `unbuiltFormatMessage` for the format menu); and the three child dialogs (import, export, settings). `IconButton` is no longer among them — the row's Download control became a `Menu`. The trailing blank line separates the imports from the local type aliases.

## Local type aliases

### The kind-meta lookup, sort field, and filter-condition types

```svelte
  type KindMeta = Record<ResourceKind, { icon: Component; tone: Tone; label: string }>;
  type SortField = 'name' | 'updated';
  type Cond = { id: string; field: 'type' | 'name'; op: string; value: string };

```

`KindMeta` maps each kind to its display metadata (icon, tone, label) so rows render a kind's visuals from one lookup. `SortField` is the closed set of sortable columns. `Cond` is a single filter condition: an id (for keyed `{#each}` and removal), the field it targets, an operator string, and a value. The trailing blank line separates the aliases from the props.

## Props

### The kind metadata and the row-action callbacks

```svelte
  let {
    kindMeta,
    onopen,
    onremove,
    onimport,
    onrename
  }: {
    kindMeta: KindMeta;
    onopen: (r: Resource) => void;
    onremove: (r: Resource) => void;
    onimport: (name: string) => void;
    onrename: (id: string, name: string) => void;
  } = $props();

```

The parent supplies `kindMeta` and a set of callbacks the table delegates to rather than performing itself: `onopen` (open a resource), `onremove` (delete), `onimport` (create from an import), and `onrename` (used by the settings dialog). Keeping these as props lets the same table drive different stages with different behaviors.

There is no `ondownload` prop any more. Download is not stage-specific — the per-kind transfer table already knows which kinds can export and how, so a stage passing a download callback was only re-deriving what the table could read directly. Worse, both stages that mounted this table passed the *same* stub, which wrote a placeholder Markdown file with none of the resource's content. The table now owns downloading (see the handlers below) and the two stages dropped their stubs. The trailing blank line separates the props from the local state.

## Filter, sort, and selection state

### Search text, filter conditions, sort spec, selection set, and dialog flags

```svelte
  let search = $state('');
  let conds = $state<Cond[]>([]);
  let match = $state<'all' | 'any'>('all');
  let sort = $state<{ field: SortField; dir: 'asc' | 'desc' }>({ field: 'updated', dir: 'desc' });

  // Multi-select (shift-click for a range) + the import/export dialogs.
  let selected = $state<Set<string>>(new Set());
  let anchorId = $state<string | null>(null);
  let importOpen = $state(false);
  let exportOpen = $state(false);
  let settingsOpen = $state(false);
  let settingsResource = $state<Resource | null>(null);

```

The first group drives filtering and ordering: the free-text `search`, the structured `conds` list, whether conditions combine with `all`/`any`, and the `sort` spec (defaulting to newest-updated first). The second group tracks interaction: `selected` is the set of checked row ids, `anchorId` is the pivot for shift-click range selection, and the remaining flags plus `settingsResource` control the three child dialogs. The trailing blank line separates the state from the styling constants.

## Shared control and grid styling constants

### The filter-control class string and the shared column template

```svelte
  // Shared control styling for the filter popover selects/inputs.
  const ctl =
    'dur-micro rounded-control border border-border bg-panel px-2 py-1 text-caption text-primary outline-none transition-colors focus:border-action';
  // One shared column template so the header and every row line up. A leading checkbox
  // column, then Name (flex), a right-aligned Updated (sm+), and actions. Type is no
  // longer a column — the colored icon conveys the kind (with a hover tooltip).
  const gridCols =
    'grid-cols-[1.75rem_minmax(0,1fr)_4.25rem] sm:grid-cols-[1.75rem_minmax(0,1fr)_6.5rem_4.25rem]';

```

`ctl` is the shared Tailwind class string applied to every select/input in the filter popover, so those controls look identical without repeating the utilities. `gridCols` is the single grid-column template the header row and every body row reference, which is what keeps the columns aligned: a fixed checkbox column, a flexible Name column, a right-aligned Updated column that only appears at `sm` and up, and an actions column. The trailing blank line separates the constants from the filter mutators.

## Filter condition mutators

### Add, retarget, remove, and clear filter conditions

```svelte
  function addCond() {
    conds = [...conds, { id: useId('f'), field: 'type', op: 'is', value: 'document' }];
  }
  function setField(id: string, field: 'type' | 'name') {
    conds = conds.map((c) =>
      c.id !== id
        ? c
        : field === 'type'
          ? { ...c, field, op: 'is', value: 'document' }
          : { ...c, field, op: 'contains', value: '' }
    );
  }
  function removeCond(id: string) {
    conds = conds.filter((c) => c.id !== id);
  }
  function clearConds() {
    conds = [];
  }

```

These manage the `conds` list immutably (each reassigns a new array so reactivity fires). `addCond` appends a fresh type-condition with a generated id. `setField` switches a condition between the `type` and `name` fields, resetting its operator and value to sensible defaults for the new field (an `is document` type match, or a `contains` name match). `removeCond` drops one by id, and `clearConds` empties them all. The trailing blank line separates them from the sort helper.

## Sort toggling

### Toggle direction on the active column or switch columns

```svelte
  // Sorting is driven by clicking the column headers (toggling direction on re-click).
  function toggleSort(field: SortField) {
    sort =
      sort.field === field
        ? { field, dir: sort.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: field === 'updated' ? 'desc' : 'asc' };
  }

```

`toggleSort` powers the clickable column headers: clicking the already-active column flips its direction, while clicking a different column switches to it with a sensible default direction — descending for Updated (newest first), ascending for Name (A–Z). The trailing blank line separates it from the condition tester.

## Condition testing

### Evaluate a single filter condition against a resource

```svelte
  function testCond(r: Resource, c: Cond): boolean {
    if (c.field === 'type') return c.op === 'is' ? r.kind === c.value : r.kind !== c.value;
    const v = c.value.trim().toLowerCase();
    return c.op === 'contains' ? r.name.toLowerCase().includes(v) : !r.name.toLowerCase().includes(v);
  }

```

`testCond` implements the predicate for one condition. Type conditions compare the resource's kind for equality or inequality; name conditions do a case-insensitive substring test (or its negation for the "excludes" operator). It is the building block the row derivation combines with `all`/`any`. The trailing blank line separates it from the rows derivation.

## The derived, filtered, sorted rows

### Compute the visible rows from search, filters, pins, and sort

```svelte
  const rows = $derived.by(() => {
    const q = search.trim().toLowerCase();
    let list = $resources.filter((r) => r.name.toLowerCase().includes(q));
    // Only conditions with a usable value participate (a blank Name filter is ignored).
    const active = conds.filter((c) => c.field === 'type' || c.value.trim() !== '');
    if (active.length) {
      list = list.filter((r) => (match === 'all' ? active.every((c) => testCond(r, c)) : active.some((c) => testCond(r, c))));
    }
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      // Pinned resources always sort first; the chosen sort orders within each group
      // (Omega leaves ordering to the client so keyset pagination stays correct).
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const cmp =
        sort.field === 'name' ? a.name.localeCompare(b.name) : a.updatedAt - b.updatedAt;
      return cmp * dir;
    });
  });

```

`rows` is the single reactive pipeline that produces what the table renders. It starts from the `resources` store filtered by the search text, then applies the active filter conditions (skipping blank name filters) combined with `all`/`any`. Finally it sorts a copy: pinned resources are forced to the top regardless of the chosen sort, and within each pinned/unpinned group it orders by name (locale compare) or by `updatedAt`, multiplied by the direction. Sorting client-side is deliberate — Omega leaves ordering to the client so its keyset pagination stays correct. The trailing blank line separates it from the selection-derived values.

## Selection-derived values

### Whether all rows are selected, and the selected resources

```svelte
  const allSelected = $derived(rows.length > 0 && rows.every((r) => selected.has(r.id)));
  const selectedResources = $derived($resources.filter((r) => selected.has(r.id)));

```

`allSelected` drives the header's select-all checkbox state — true only when there are rows and every visible row is checked. `selectedResources` resolves the checked ids back to full `Resource` objects (from the whole store, not just visible rows) for the header's bulk download. The trailing blank line separates these from the selection handlers.

## Row selection handlers

### Toggle a row (with shift-range), select all, and clear

```svelte
  function toggleRow(e: MouseEvent, id: string, index: number) {
    if (e.shiftKey && anchorId) {
      const ids = rows.map((r) => r.id);
      const a = ids.indexOf(anchorId);
      if (a >= 0) {
        const [lo, hi] = a < index ? [a, index] : [index, a];
        const next = new Set(selected);
        for (const rid of ids.slice(lo, hi + 1)) next.add(rid);
        selected = next;
        return;
      }
    }
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected = next;
    anchorId = id;
  }
  function toggleAll() {
    selected = allSelected ? new Set() : new Set(rows.map((r) => r.id));
  }
  function clearSelection() {
    selected = new Set();
    anchorId = null;
  }
```

`toggleRow` handles both plain and range selection: with Shift held and a prior `anchorId`, it adds every row between the anchor and the clicked index (in visible order) to the selection; otherwise it toggles the single clicked row and moves the anchor there. Each mutation replaces the `Set` so reactivity fires. `toggleAll` selects every visible row or clears the selection depending on `allSelected` — which is why the header needs no separate "Clear" button: clicking the select-all checkbox a second time already empties the selection. `clearSelection` empties it and resets the anchor, and is called from `doExport` rather than from a control of its own. The next line begins the export/share handlers.

## Download, export, and share handlers, script close

### Download one resource, build the row's format menu, run the bulk export, and copy a share link

```svelte
  /**
   * Download one resource in a chosen format. The table owns this rather than
   * taking an `ondownload` prop: the per-kind transfer table already knows which
   * kinds can export and how, so a stage would only be re-deriving it — and both
   * stages used to pass a stub that downloaded a placeholder file with no real
   * content, which is exactly the kind of fake this repo does not ship.
   */
  async function downloadOne(r: Resource, format: ExportFormat) {
    if (!format.built) {
      toast(unbuiltFormatMessage(format), { tone: 'attention' });
      return;
    }
    const exporter = exporterFor(r.kind);
    if (!exporter) {
      toast(`${kindMeta[r.kind].label} resources can’t be exported yet.`, { tone: 'attention' });
      return;
    }
    try {
      await exporter.run(r.id, r.name);
    } catch {
      toast(`Could not export “${r.name}”.`, { tone: 'danger' });
    }
  }
  function downloadItems(r: Resource) {
    return exportFormats.map((format) => ({
      label: format.label,
      onselect: () => void downloadOne(r, format)
    }));
  }
  async function doExport(formatId: string) {
    const format = exportFormats.find((f) => f.id === formatId) ?? exportFormats[0];
    const targets = selectedResources.length ? selectedResources : rows;
    exportOpen = false;
    clearSelection();
    if (!format.built) {
      toast(unbuiltFormatMessage(format), { tone: 'attention' });
      return;
    }
    // Sequential on purpose: each export is a request plus a browser download,
    // and firing a dozen at once gets them throttled or dropped.
    const exportable = targets.filter((r) => exporterFor(r.kind));
    for (const r of exportable) await downloadOne(r, format);
    if (exportable.length < targets.length) {
      toast(
        `Exported ${exportable.length} of ${targets.length} — the rest are kinds that can’t export yet.`,
        { tone: 'attention' }
      );
    }
  }
  function shareResource(r: Resource) {
    navigator.clipboard?.writeText(`${location.origin}/r/${r.id}`);
    toast('Resource link copied (mock)', { tone: 'success' });
  }
</script>

```

`downloadOne` is the single export path both surfaces funnel through, and it refuses in two ways before it ever writes a file: a format with no serializer gets the shared `unbuiltFormatMessage` as an attention toast, and a kind with no `ExportSpec` is named in its own toast (`kindMeta` supplies the label). Only past both guards does it await the kind's `exporter.run(id, name)`, which triggers the download itself; a rejection becomes a danger toast naming the resource. The doc comment records why the table owns this instead of taking an `ondownload` prop.

`downloadItems(r)` maps the shared `exportFormats` into `Menu` items for one row, so the row's Download menu is the same four entries — with the same "— soon" labels — the editor's Export menu shows.

`doExport(formatId)` is the action confirmed from the export dialog behind the header's Download button. It resolves the dialog's format id back to a full format record (falling back to the first, Markdown), targets the checked resources or every visible row when nothing is checked, then closes the dialog and clears the selection *before* doing any work, so the UI settles immediately. An unbuilt format stops there with the same message. Otherwise it filters the targets down to kinds that can actually export and awaits `downloadOne` for each **one at a time** — sequential on purpose, because each export is a request plus a browser download and a dozen fired at once get throttled or dropped — and if anything was filtered out, a closing toast reports the shortfall honestly rather than letting the user assume all of them landed.

`shareResource` copies a resource permalink to the clipboard and shows a success toast — a mock link for now, as the marker in the message notes. The `</script>` closes the logic; the trailing blank line separates the script from the markup.

## Markup: table frame, the single header row, and the sort-header snippet

### Open the frame and the one header grid, then define the reusable sortable-column button

```svelte
<!-- The table frame: ONE header row stays fixed; only rows scroll. -->
<div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel border border-border">
  <!-- The single header row: select-all, Name (+ selection count + table actions),
       and the sortable Updated column. -->
  <div class={cn('relative grid shrink-0 items-center gap-3 border-b border-border bg-panel/50 px-4 py-1.5', gridCols)}>
    {#snippet sortHeader(label: string, field: SortField, extra = '')}
      <button
        onclick={() => toggleSort(field)}
        class={cn(
          'dur-micro inline-flex items-center gap-1 text-caption font-medium text-muted transition-colors hover:text-secondary',
          sort.field === field && 'text-secondary',
          extra
        )}
      >
        {label}
        {#if sort.field === field}
          {#if sort.dir === 'asc'}<ArrowUp class="size-3" />{:else}<ArrowDown class="size-3" />{/if}
        {/if}
      </button>
    {/snippet}
```

The outer `<div>` is the flex frame that clips overflow so only the row body scrolls. Inside it there is exactly **one** fixed bar: the column-header grid, built on the shared `gridCols` template so its cells align with every body row. It carries the columns *and* the table-level controls — see the next section for how the controls fit without disturbing the grid.

The `sortHeader` snippet is a reusable sortable-column button: it calls `toggleSort(field)`, highlights itself when it is the active sort column, accepts an `extra` class string for per-instance layout, and shows an up/down arrow reflecting the current direction. It is defined once at the top of the grid and rendered for both the Name and Updated columns.

## Markup: select-all, the Name cell, and the centred action group

### The select-all checkbox, the Name sort header with its inline selection count, and the group that hosts the four table controls

```svelte
    <button
      type="button"
      onclick={toggleAll}
      aria-label="Select all"
      aria-pressed={allSelected}
      class={cn(
        'dur-micro flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors',
        allSelected || selected.size > 0 ? 'border-action bg-action text-action-fg' : 'border-border-strong hover:border-action'
      )}
    >
      {#if allSelected}<Check class="size-3" />{:else if selected.size > 0}<Minus class="size-3" />{/if}
    </button>
    <div class="flex items-center gap-1.5">
      {@render sortHeader('Name', 'name')}
      {#if selected.size > 0}
        <span class="text-caption font-medium text-action">{selected.size} selected</span>
      {/if}
      <div class="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1">
```

The first grid cell is the select-all checkbox: it renders a `Check` when everything is selected, a `Minus` (indeterminate) when only some are, and tints itself active in either case. Clicking it again when everything is selected clears the selection, which is the only "clear" affordance the table needs.

The Name cell is a flex row, and it holds three things in order. First the Name sort header. Then, only while something is checked, an inline **"N selected"** count — a label beside the column heading rather than a bar of its own. Then the action group opened at the end of this excerpt, which carries the four table-level controls in the order the next sections cover them: **search**, **filter**, **Download**, **Import**. All four are **icon-only** and the same size, and each carries `aria-label` and `title` — the label is a tooltip and a screen-reader name rather than visible text, which is what lets four controls sit in the header without crowding it. The order groups them by what they do: the two popovers that narrow *what you are looking at* come first, then the two dialogs that move data in and out.

The group is positioned against the header row rather than inside a column so it centres on the **bar** — no grid cell's centre is the bar's centre, so centring within the Name column left it visibly off. It fills what used to be dead space between "Name" and "Updated".

The comment records why the layout landed here, and it is worth heeding before rearranging anything. Three stacked bars — controls, headers, selection — for a single table was visually heavy while the middle of the header row sat empty; folding all three into one both lightens it and uses that gap. The two earlier arrangements both had problems: putting the controls in their own row above the headers cost a whole extra bar, and before that they lived in the *last cell of the header grid*, which `gridCols` sizes for what a row puts there — two icon buttons, `4.25rem`. Four controls do not fit in `4.25rem`, so they spilled leftwards and drew on top of the "Updated" header. Hosting them in the flexible Name cell avoids both failure modes: the cell is as wide as the table allows, and the grid still has exactly one cell per column track.

## Markup: search popover

### The search control that opens the action group

```svelte
          <Popover
            placement="bottom-end"
            label="Search"
            triggerClass={cn(
              'dur-small inline-flex size-8 items-center justify-center rounded-control transition-colors',
              search ? 'text-action' : 'text-muted hover:bg-panel hover:text-primary'
            )}
          >
            {#snippet trigger()}<Search class="size-4" />{/snippet}
            <div class="w-60">
              <Input bind:value={search} placeholder="Search resources…" class="h-8 w-full" />
            </div>
          </Popover>
```

Search leads the group because it is the control reached for most often. Its trigger is a Search icon that tints active whenever there is search text, so a table narrowed by a search typed earlier still says so on the bar once the popover is closed, and it reveals a single `Input` bound to `search` that the rows derivation reacts to as it is typed.

## Markup: filter popover

### The filter control with match mode, per-condition rows, and add/clear

```svelte
          <Popover
            placement="bottom-end"
            label="Filter"
            triggerClass={cn(
              'dur-small relative inline-flex size-8 items-center justify-center rounded-control transition-colors',
              conds.length > 0 ? 'text-action' : 'text-muted hover:bg-panel hover:text-primary'
            )}
          >
            {#snippet trigger()}
              <Filter class="size-4" />
              {#if conds.length > 0}
                <span class="absolute -right-0.5 -top-0.5 flex min-w-3.5 items-center justify-center rounded-full bg-action px-0.5 text-[9px] font-semibold leading-none text-action-fg">
                  {conds.length}
                </span>
              {/if}
            {/snippet}
            <div class="w-72 space-y-2">
              {#if conds.length === 0}
                <p class="px-1 py-1 text-caption text-muted">No filters yet. Add one below.</p>
              {/if}
              {#if conds.length >= 2}
                <div class="flex items-center gap-1.5 text-caption text-muted">
                  <span>Match</span>
                  <select value={match} onchange={(e) => (match = e.currentTarget.value as 'all' | 'any')} class={ctl}>
                    <option value="all">all</option>
                    <option value="any">any</option>
                  </select>
                  <span>of the filters</span>
                </div>
              {/if}
              {#each conds as c (c.id)}
                <div class="flex items-center gap-1.5">
                  <select value={c.field} onchange={(e) => setField(c.id, e.currentTarget.value as 'type' | 'name')} class={ctl}>
                    <option value="type">Type</option>
                    <option value="name">Name</option>
                  </select>
                  {#if c.field === 'type'}
                    <select bind:value={c.op} class={ctl}>
                      <option value="is">is</option>
                      <option value="is not">is not</option>
                    </select>
                    <select bind:value={c.value} class={cn(ctl, 'min-w-0 flex-1')}>
                      {#each RESOURCE_KINDS as k (k.id)}<option value={k.id}>{kindMeta[k.id].label}</option>{/each}
                    </select>
                  {:else}
                    <select bind:value={c.op} class={ctl}>
                      <option value="contains">contains</option>
                      <option value="not">excludes</option>
                    </select>
                    <input bind:value={c.value} placeholder="text…" class={cn(ctl, 'min-w-0 flex-1 placeholder:text-muted')} />
                  {/if}
                  <button onclick={() => removeCond(c.id)} aria-label="Remove filter" class="dur-micro shrink-0 rounded p-1 text-muted transition-colors hover:bg-panel hover:text-primary">
                    <X class="size-3.5" />
                  </button>
                </div>
              {/each}
              <div class="flex items-center justify-between border-t border-border pt-2">
                <button onclick={addCond} class="dur-micro inline-flex items-center gap-1 text-caption font-medium text-action transition-opacity hover:opacity-80">
                  <Plus class="size-3.5" /> Add filter
                </button>
                {#if conds.length > 0}
                  <button onclick={clearConds} class="dur-micro text-caption text-muted transition-colors hover:text-primary">Clear all</button>
                {/if}
              </div>
            </div>
          </Popover>
```

The filter `Popover` is the second control in the action group, sitting with search because the two answer the same question — *which rows am I looking at*. Its trigger is a Filter icon that tints active and shows a small count badge when any conditions exist. The panel shows an empty hint when there are none, a match-mode selector (`all`/`any`) once there are two or more, and a keyed row per condition. Each row picks the field (Type or Name); a Type condition offers is/is-not with a kind dropdown built from `RESOURCE_KINDS`, while a Name condition offers contains/excludes with a text input; every control shares the `ctl` class, and an X button removes the row. A footer adds a new condition and, when any exist, clears them all.

## Markup: the Download and Import buttons

### The two dialog triggers that close the action group

```svelte
          <button
            type="button"
            onclick={() => (exportOpen = true)}
            aria-label="Download"
            title="Download"
            class="dur-small inline-flex size-8 items-center justify-center rounded-control text-muted transition-colors hover:bg-panel hover:text-primary"
          >
            <Download class="size-4" />
          </button>
          <button
            type="button"
            onclick={() => (importOpen = true)}
            aria-label="Import"
            title="Import"
            class="dur-small inline-flex size-8 items-center justify-center rounded-control text-muted transition-colors hover:bg-panel hover:text-primary"
          >
            <FileInput class="size-4" />
          </button>
```

**Download** opens `ExportDialog`, which confirms a format and hands it to `doExport` — the checked resources, or every visible row when nothing is checked. Its label is **Download**, not Export, because every row already carries a Download menu that does the same thing for one resource: two words for one action made the header control look like a third thing the table could do. One word now means one thing everywhere in the table, whichever surface you reach for. The two do carry different **accessible names** — the header is `Download`, each row is `Row download` — because an identical name on two controls in one table is ambiguous to anyone navigating by name, screen-reader user or test alike; the visible tooltip stays `Download` on both.

**Import** opens `ImportDialog`, which hands the new name back through the `onimport` prop. Its icon is `FileInput` — an arrow entering a document — rather than `Upload`: an up-and-out arrow reads as content *leaving*, the opposite of what importing does, and it is the one glyph that must never be mistaken for the downward arrow sitting immediately beside it.

## Markup: action-group close, Updated header, and header-row close

### Close the action group and the Name cell, then the Updated column and the actions spacer

```svelte
      </div>
    </div>
    {@render sortHeader('Updated', 'updated', 'hidden justify-self-end sm:inline-flex')}
    <span></span>
  </div>


```

The two `</div>`s close the centred action group and the Name cell that hosts it.

Back at grid level, the Updated sort header follows with extra classes to right-align it and hide it below the `sm` breakpoint (matching the responsive `gridCols`). The last cell is an empty `<span>`: it holds the actions column open so the header grid still has a cell per template track and the columns above and below stay in step — and, importantly, it stays empty, because that `4.25rem` track is too narrow for anything but a row's two icon buttons. The closing `</div>` ends the header row, and with it the table's only fixed bar; the blank lines separate it from the row body.

## Markup: empty state

### Show an empty state when no rows match

```svelte
  {#if rows.length === 0}
    <div class="flex flex-1 items-center justify-center p-6">
      <EmptyState
        title={$resources.length === 0 ? 'No resources yet' : 'No matches'}
        description={$resources.length === 0 ? 'Create one from the bar above.' : 'Try a different filter or search.'}
      />
    </div>
  {:else}
```

When the derived `rows` is empty, the table centers an `EmptyState`. Its copy distinguishes the two empty cases: a genuinely empty catalog ("No resources yet" / create prompt) versus a non-empty catalog whose filters/search matched nothing ("No matches" / adjust prompt). The `{:else}` opens the branch that renders the actual rows.

## Markup: row body

### Render each resource row with checkbox, identity, timestamp, and actions

```svelte
    <!-- Row body (scrolls) -->
    <div class="min-h-0 flex-1 overflow-y-auto">
      {#each rows as r, i (r.id)}
        {@const meta = kindMeta[r.kind]}
        {@const Icon = meta.icon}
        {@const isSel = selected.has(r.id)}
        <div class={cn('group dur-micro grid items-center gap-3 border-b border-border px-4 py-2 transition-colors last:border-0 hover:bg-panel/40', gridCols, isSel && 'bg-action/5')}>
          <button
            type="button"
            onclick={(e) => toggleRow(e, r.id, i)}
            aria-label={`Select ${r.name}`}
            aria-pressed={isSel}
            class={cn(
              'dur-micro flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-all',
              isSel ? 'border-action bg-action text-action-fg opacity-100' : 'border-border-strong opacity-0 hover:border-action group-hover:opacity-100'
            )}
          >
            {#if isSel}<Check class="size-3" />{/if}
          </button>
          <div class="flex min-w-0 items-center gap-3">
            <span title={meta.label} class={cn('flex size-7 shrink-0 items-center justify-center rounded-control', iconTileClass(meta.tone))}>
              <Icon class="size-3.5" />
            </span>
            <button onclick={() => onopen(r)} class="dur-micro min-w-0 truncate text-left text-body-sm font-medium text-primary transition-colors hover:text-action">
              {r.name}
            </button>
            {#if r.pinned}
              <Pin class="size-3 shrink-0 -rotate-45 fill-current text-muted" aria-label="Pinned" />
            {/if}
          </div>
          <span class="hidden whitespace-nowrap text-right text-caption text-muted sm:block">{relativeTime(r.updatedAt)}</span>
          <div class="flex items-center gap-1 justify-self-end">
            <!-- Download offers the same format set as the editor's Export menu
                 (one shared table), so the two surfaces cannot drift. -->
            <Menu
              align="end"
              label="Row download"
              title="Download"
              items={downloadItems(r)}
              triggerClass="dur-small inline-flex size-8 items-center justify-center rounded-control text-muted transition-colors hover:bg-panel hover:text-primary"
            >
              {#snippet trigger()}<Download class="size-4" />{/snippet}
            </Menu>
            <Menu
              align="end"
              label="More options"
              triggerClass="dur-small inline-flex size-8 items-center justify-center rounded-control text-muted transition-colors hover:bg-panel hover:text-primary"
              items={[
                {
                  label: `${meta.label} settings`,
                  onselect: () => {
                    settingsResource = r;
                    settingsOpen = true;
                  }
                },
                { label: 'Share link', onselect: () => shareResource(r) },
                { divider: true },
                { label: 'Remove', danger: true, onselect: () => onremove(r) }
              ]}
            >
              {#snippet trigger()}<MoreHorizontal class="size-4" />{/snippet}
            </Menu>
          </div>
        </div>
      {/each}
    </div>
  {/if}
```

The scrollable body renders one keyed row per resource. Three `{@const}`s resolve the row's kind metadata, icon component, and selected state up front. Each row uses the same `gridCols` template and tints when selected. The first cell is a checkbox that calls `toggleRow` (passing the index so shift-range works) and stays hidden until hover unless selected. The identity cell shows the tinted kind tile (title-tooltiped), the name as a button that calls `onopen`, and a pin indicator when pinned. The Updated cell shows the relative time (hidden below `sm`). The actions cell holds two menus behind identical icon triggers: a **Download** `Menu` whose items come from `downloadItems(r)` — the four shared formats, so a row offers exactly what the editor's Export menu does — and a **More options** `Menu` whose items open the settings dialog for this row, copy a share link, or remove it. Download used to be a one-click `IconButton`; it became a menu when the formats became a real choice rather than an implied Markdown. The closing `{/each}`, `</div>`, and `{/if}` end the loop, the body, and the rows/empty branch.

## Markup: frame close and child dialogs

### Close the frame and mount the import, export, and settings dialogs

```svelte
</div>

<ImportDialog bind:open={importOpen} {onimport} />
<ExportDialog bind:open={exportOpen} count={selected.size || rows.length} onconfirm={doExport} />
<ResourceSettingsDialog bind:open={settingsOpen} resource={settingsResource} {kindMeta} {onrename} {onremove} />
```

The final `</div>` closes the table frame. The three child dialogs are mounted as siblings, each bound to its own `open` flag: `ImportDialog` forwards `onimport`; `ExportDialog` receives the selected count (or the visible-row count when nothing is checked) and confirms into `doExport`, handing back the chosen format id; and `ResourceSettingsDialog` receives the current `settingsResource`, the kind metadata, and the rename/remove callbacks. Keeping them at the top level (outside the scrolling frame) means their overlays are not clipped by the frame's `overflow-hidden`.

## Inspection is separate from the checkbox set

```svelte
<div role="grid" aria-label="Resources" …>
  <div role="row" tabindex="0" aria-selected={isInspected}
       onclick={(e) => inspectRow(e, r)} onkeydown={(e) => inspectRowKey(e, r)} …>
```

Clicking a row reports it through `oninspect`; the checkbox column reports the bulk set through
`onselectionchange`. These are **two different selections and stay that way** — merging them would
mean that clicking a row to look at it silently adds it to whatever the header's Download acts on.
An inspected row is drawn with a left accent bar and a panel tint; a checked row keeps its existing
`bg-action/5`. Both props are optional, so `NewTabStage` — which renders this table with no
inspector — is unaffected.

```ts
function inspectRow(e: MouseEvent, r: Resource) {
  if ((e.target as HTMLElement).closest('button, a')) return;
  oninspect?.(r);
}
```

The guard is what lets a row be a click target without breaking the four controls it contains: the
checkbox, the name (which opens), and the two menus each keep their own meaning, and only clicks
landing on the row itself inspect. `inspectRowKey` additionally checks `e.target === e.currentTarget`
so Enter pressed inside a focused child control does not also inspect.

The `grid`/`row` roles replaced bare `div`s when the row became interactive. `role="button"` would
have been the easier way to satisfy Svelte's a11y check, but it would announce the whole row as a
button and bury the semantics of the controls inside it; `row` inside `grid` is the pattern that
exists for exactly this — a tabular list whose rows are selectable and whose cells contain controls.

`setSelection` is the single writer for `selected`, so every path that changes the checkbox set
(toggle, shift-range, select-all, and the clear after an export) notifies the host — an earlier
version updated `selected` directly in four places and would have drifted.
