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

  type KindMeta = Record<ResourceKind, { icon: Component; tone: Tone; label: string }>;
  type SortField = 'name' | 'updated';
  type Cond = { id: string; field: 'type' | 'name'; op: string; value: string };

  let {
    kindMeta,
    onopen,
    onremove,
    onimport,
    onrename,
    inspectedId = null,
    oninspect,
    onselectionchange
  }: {
    kindMeta: KindMeta;
    onopen: (r: Resource) => void;
    onremove: (r: Resource) => void;
    onimport: (name: string) => void;
    onrename: (id: string, name: string) => void;
    /** The row drawn as inspected. Optional — a host that shows no lens omits it. */
    inspectedId?: string | null;
    /** A row was clicked somewhere other than one of its own controls. */
    oninspect?: (r: Resource) => void;
    /** The checkbox set changed. Distinct from `oninspect`: this is the bulk set. */
    onselectionchange?: (ids: string[]) => void;
  } = $props();

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

  // Shared control styling for the filter popover selects/inputs.
  const ctl =
    'dur-micro rounded-control border border-border bg-panel px-2 py-1 text-caption text-primary outline-none transition-colors focus:border-action';
  // One shared column template so the header and every row line up. A leading checkbox
  // column, then Name (flex), a right-aligned Updated (sm+), and actions. Type is no
  // longer a column — the colored icon conveys the kind (with a hover tooltip).
  const gridCols =
    'grid-cols-[1.75rem_minmax(0,1fr)_4.25rem] sm:grid-cols-[1.75rem_minmax(0,1fr)_6.5rem_4.25rem]';

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

  // Sorting is driven by clicking the column headers (toggling direction on re-click).
  function toggleSort(field: SortField) {
    sort =
      sort.field === field
        ? { field, dir: sort.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: field === 'updated' ? 'desc' : 'asc' };
  }

  function testCond(r: Resource, c: Cond): boolean {
    if (c.field === 'type') return c.op === 'is' ? r.kind === c.value : r.kind !== c.value;
    const v = c.value.trim().toLowerCase();
    return c.op === 'contains' ? r.name.toLowerCase().includes(v) : !r.name.toLowerCase().includes(v);
  }

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

  const allSelected = $derived(rows.length > 0 && rows.every((r) => selected.has(r.id)));
  const selectedResources = $derived($resources.filter((r) => selected.has(r.id)));

  function setSelection(next: Set<string>) {
    selected = next;
    onselectionchange?.([...next]);
  }
  function toggleRow(e: MouseEvent, id: string, index: number) {
    if (e.shiftKey && anchorId) {
      const ids = rows.map((r) => r.id);
      const a = ids.indexOf(anchorId);
      if (a >= 0) {
        const [lo, hi] = a < index ? [a, index] : [index, a];
        const next = new Set(selected);
        for (const rid of ids.slice(lo, hi + 1)) next.add(rid);
        setSelection(next);
        return;
      }
    }
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelection(next);
    anchorId = id;
  }
  function toggleAll() {
    setSelection(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }
  function clearSelection() {
    setSelection(new Set());
    anchorId = null;
  }
  /**
   * A click on the row itself — not on one of the controls it contains. The
   * name, checkbox, and the two menus keep their own meanings, so anything that
   * lands on a control is left alone and only the surrounding row area inspects.
   */
  function inspectRow(e: MouseEvent, r: Resource) {
    if ((e.target as HTMLElement).closest('button, a')) return;
    oninspect?.(r);
  }
  function inspectRowKey(e: KeyboardEvent, r: Resource) {
    if (e.target !== e.currentTarget) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    oninspect?.(r);
  }
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
      </div>
    </div>
    {@render sortHeader('Updated', 'updated', 'hidden justify-self-end sm:inline-flex')}
    <span></span>
  </div>


  {#if rows.length === 0}
    <div class="flex flex-1 items-center justify-center p-6">
      <EmptyState
        title={$resources.length === 0 ? 'No resources yet' : 'No matches'}
        description={$resources.length === 0 ? 'Create one from the bar above.' : 'Try a different filter or search.'}
      />
    </div>
  {:else}
    <!-- Row body (scrolls). A grid of rows rather than plain divs: the row itself
         is a click target now, and `row` keeps that from stripping the semantics
         of the controls each row contains. -->
    <div role="grid" aria-label="Resources" class="min-h-0 flex-1 overflow-y-auto">
      {#each rows as r, i (r.id)}
        {@const meta = kindMeta[r.kind]}
        {@const Icon = meta.icon}
        {@const isSel = selected.has(r.id)}
        {@const isInspected = r.id === inspectedId}
        <div
          role="row"
          tabindex="0"
          aria-selected={isInspected}
          onclick={(e) => inspectRow(e, r)}
          onkeydown={(e) => inspectRowKey(e, r)}
          class={cn('group dur-micro relative grid items-center gap-3 border-b border-border px-4 py-2 outline-none transition-colors last:border-0 hover:bg-panel/40 focus-visible:bg-panel/40', gridCols, isSel && 'bg-action/5', isInspected && 'bg-panel/60')}
        >
          {#if isInspected}
            <span class="absolute left-0 top-0 h-full w-0.5 bg-action" aria-hidden="true"></span>
          {/if}
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
</div>

<ImportDialog bind:open={importOpen} {onimport} />
<ExportDialog bind:open={exportOpen} count={selected.size || rows.length} onconfirm={doExport} />
<ResourceSettingsDialog bind:open={settingsOpen} resource={settingsResource} {kindMeta} {onrename} {onremove} />
