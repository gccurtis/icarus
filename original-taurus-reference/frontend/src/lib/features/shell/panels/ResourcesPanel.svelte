<script lang="ts">
  import { ChevronRight, Download, Lock, Upload } from '@lucide/svelte';
  import { cn } from '$lib/utils';
  import { resources, type Resource } from '$data/resources';
  import { openTab, workspace } from '$data/workspace';
  import { iconTileClass } from '$data/projects';
  import { kindMeta } from '$lib/features/shared/kinds';
  import { importers, exporterFor, type ImportSpec } from '$lib/features/shared/transfer';
  import { Button, EmptyState, Input, Modal, PanelResults, toast } from '$lib/components';
  import { isApiError } from '$data/api';
  import { groupResources, matchSummary } from './resource-groups';

  // Import / export are project-level, so they live here (the "All resources" panel),
  // both as modals. WHICH kinds can move through a file — and how — is the transfer
  // table's knowledge (features/shared/transfer.ts); this panel names no kind.
  let importOpen = $state(false);
  let exportOpen = $state(false);
  let busy = $state(false);

  // The navigator's own search. It filters THIS list, and is not the Overview
  // table's search: the table filters rows you are working with, the rail finds a
  // thing to open. Name-substring over the fully-loaded catalog
  // (`enterProjectResources` pages `/resources` to exhaustion), so it is complete —
  // searching inside documents would need a content-search route Omega does not have.
  let query = $state('');
  let collapsed = $state(new Set<string>());

  const groups = $derived(groupResources($resources, query));
  const summary = $derived(matchSummary($resources, query));
  const exportables = $derived($resources.filter((r) => exporterFor(r.kind)));

  // Which resources already have a tab, so the rail can mark them.
  //
  // Marking only the ACTIVE resource would be near-invisible: a stage that opens a
  // resource (document, slides) contributes its own context set and replaces this
  // panel, so while a resource is active this lens is usually not on screen.
  // "Already open in a tab" is the fact that is useful from Overview, and the
  // active one — reachable from stages that don't claim the rail — is marked too.
  const openResourceIds = $derived(
    new Set(($workspace?.tabs ?? []).map((t) => t.resourceId).filter(Boolean))
  );
  const activeResourceId = $derived(
    $workspace?.tabs.find((t) => t.id === $workspace?.activeTabId)?.resourceId ?? null
  );

  // A search auto-reveals its matches: collapse state is the user's answer to
  // "show me less", not an instruction to hide the thing they just searched for.
  function isOpen(groupId: string): boolean {
    return Boolean(query.trim()) || !collapsed.has(groupId);
  }

  function toggle(groupId: string) {
    const next = new Set(collapsed);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    collapsed = next;
  }

  async function importFile(spec: ImportSpec, event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || busy) return;
    busy = true;
    try {
      const created = await spec.run(file);
      openTab(created.name, created.id, created.kind);
      importOpen = false;
      toast(`Imported “${created.name}”.`, { tone: 'success' });
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Import failed', { tone: 'danger' });
    } finally {
      busy = false;
    }
  }

  async function exportResource(r: Resource) {
    const spec = exporterFor(r.kind);
    if (!spec || busy) return;
    busy = true;
    try {
      await spec.run(r.id, r.name);
      exportOpen = false;
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Export failed', { tone: 'danger' });
    } finally {
      busy = false;
    }
  }
</script>

<!--
  Project-context "All resources": the project's real Omega catalog as a navigator.
  `flex h-full flex-col` keeps transfer + search fixed and hands the scroll to
  PanelResults (see components/PanelResults.svelte) — the user's requirement is that
  import, export, and the search field never scroll out of reach.
-->
<div class="flex h-full flex-col">
  <div class="shrink-0 space-y-2 pt-1">
    {#if importers.length}
      <div class="flex items-center gap-1.5">
        <Button variant="secondary" size="sm" class="flex-1" onclick={() => (importOpen = true)}>
          <Upload class="size-4" />
          Import
        </Button>
        <Button variant="secondary" size="sm" class="flex-1" onclick={() => (exportOpen = true)}>
          <Download class="size-4" />
          Export
        </Button>
      </div>
    {/if}

    <Input bind:value={query} size="sm" placeholder="Find a resource…" aria-label="Find a resource" />

    {#if summary}
      <p class="text-caption text-muted" aria-live="polite">
        {summary.matched} of {summary.total} match
      </p>
    {/if}
  </div>

  <PanelResults class="mt-2">
    {#if groups.length === 0}
      {#if query.trim()}
        <p class="px-1 py-3 text-body-sm text-muted">Nothing matches “{query.trim()}”.</p>
      {:else}
        <EmptyState title="No resources yet" description="Create one from the project overview." />
      {/if}
    {/if}

    {#each groups as group (group.id)}
      {@const open = isOpen(group.id)}
      <button
        type="button"
        onclick={() => toggle(group.id)}
        aria-expanded={open}
        class="dur-micro flex w-full items-center gap-1 rounded-control py-1.5 pr-1 text-left transition-colors hover:bg-elevated"
      >
        <ChevronRight class={cn('size-3.5 shrink-0 text-muted transition-transform', open && 'rotate-90')} />
        <span class="min-w-0 truncate text-label uppercase tracking-wide text-muted">{group.label}</span>
        <span class="ml-auto shrink-0 tabular-nums text-caption text-muted">
          {#if query.trim() && group.items.length !== group.total}
            {group.items.length} of {group.total}
          {:else}
            {group.total}
          {/if}
        </span>
      </button>

      {#if open}
        <ul class="mb-1 space-y-0.5">
          {#each group.items as r (r.id)}
            {@const meta = kindMeta[r.kind]}
            {@const Icon = meta.icon}
            {@const isOpenTab = openResourceIds.has(r.id)}
            <li>
              <button
                type="button"
                onclick={() => openTab(r.name, r.id, r.kind)}
                aria-current={activeResourceId === r.id ? 'true' : undefined}
                class={cn(
                  'dur-micro flex w-full items-center gap-2 rounded-control py-1.5 pl-3 pr-1.5 text-left transition-colors hover:bg-elevated',
                  activeResourceId === r.id && 'bg-action/10'
                )}
              >
                <span class={cn('flex size-6 shrink-0 items-center justify-center rounded-control', iconTileClass(meta.tone))}>
                  <Icon class="size-3.5" />
                </span>
                <span
                  class={cn(
                    'min-w-0 truncate text-body-sm',
                    isOpenTab ? 'font-medium text-primary' : 'text-secondary'
                  )}
                >
                  {r.name}
                </span>
                <span class="ml-auto flex shrink-0 items-center gap-1.5">
                  {#if !r.access.projectWide}
                    <Lock class="size-3 text-muted" aria-label="Restricted" />
                  {/if}
                  {#if isOpenTab}
                    <span class="size-1.5 rounded-full bg-action" aria-label="Open in a tab"></span>
                  {/if}
                </span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {/each}
  </PanelResults>
</div>

<Modal bind:open={importOpen} title="Import" size="sm">
  <div class="space-y-3">
    {#each importers as { kind, spec } (kind)}
      <p class="text-body-sm text-muted">{spec.description}</p>
      <label
        class="dur-micro flex cursor-pointer items-center justify-center rounded-control border border-dashed border-border-strong px-3 py-6 text-body-sm text-secondary transition-colors hover:border-action hover:bg-panel"
      >
        <input
          type="file"
          accept={spec.accept}
          onchange={(event) => importFile(spec, event)}
          disabled={busy}
          class="sr-only"
        />
        <span class="flex items-center gap-2">
          <Upload class="size-4" />
          {busy ? spec.busyLabel : spec.prompt}
        </span>
      </label>
    {/each}
  </div>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (importOpen = false)}>Cancel</Button>
  {/snippet}
</Modal>

<Modal bind:open={exportOpen} title="Export" size="sm">
  <div class="space-y-3">
    {#if exportables.length === 0}
      <p class="text-body-sm text-muted">Nothing in this project can be exported yet.</p>
    {:else}
      <ul class="space-y-1">
        {#each exportables as r (r.id)}
          <li>
            <button
              type="button"
              disabled={busy}
              onclick={() => exportResource(r)}
              class="dur-micro flex w-full items-center justify-between gap-2 rounded-control border border-border px-2.5 py-2 text-left transition-colors hover:border-border-strong hover:bg-panel disabled:opacity-40"
              title={exporterFor(r.kind)?.description}
            >
              <span class="min-w-0 truncate text-body-sm text-secondary">{r.name}</span>
              <Download class="size-4 shrink-0 text-muted" />
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (exportOpen = false)}>Close</Button>
  {/snippet}
</Modal>
