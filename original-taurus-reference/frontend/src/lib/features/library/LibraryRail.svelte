<script lang="ts">
  import { Building2, Layers, Plus, Search } from '@lucide/svelte';
  import { Divider, IconButton, Input, Select } from '$lib/components';
  import { OWNERS, memberMeta, type LibraryContext, type LibraryTemplate } from './library-mock';

  // The library map: owner scope, search, and the assets themselves. Rows carry a
  // name and nothing else — counts and dates looked like data but answered no
  // question a browsing user actually has, so they live in the detail panel.
  let {
    space,
    contexts,
    templates,
    selectedId,
    onselect,
    query = $bindable(''),
    owner = $bindable('all')
  }: {
    space: 'context' | 'templates';
    contexts: LibraryContext[];
    templates: LibraryTemplate[];
    selectedId: string;
    onselect: (id: string) => void;
    query?: string;
    owner?: string;
  } = $props();

  const isOrg = (id: string) => OWNERS.find((o) => o.id === id)?.kind === 'org';
</script>

<aside class="surface-context flex w-context shrink-0 flex-col">
  <div class="space-y-2 p-3">
    <div class="flex items-center justify-between">
      <p class="text-label uppercase tracking-wide text-muted">
        {space === 'context' ? 'Context library' : 'Template library'}
      </p>
      <IconButton size="sm" label="New"><Plus class="size-4" /></IconButton>
    </div>
    <div class="relative">
      <Search
        class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted"
      />
      <Input bind:value={query} size="sm" placeholder="Search" aria-label="Search" class="pl-8" />
    </div>
    <Select
      bind:value={owner}
      size="sm"
      aria-label="Owner"
      options={[
        { value: 'all', label: 'All owners' },
        ...OWNERS.map((o) => ({ value: o.id, label: o.label }))
      ]}
    />
  </div>

  <Divider />

  <div class="quiet-scroll min-h-0 flex-1 overflow-y-auto p-2">
    {#if space === 'context'}
      {#each contexts as c (c.id)}
        <button
          class="dur-micro flex w-full items-center gap-2 rounded-control px-2 py-2 text-left transition-colors {c.id ===
          selectedId
            ? 'bg-selection'
            : 'hover:bg-work'}"
          onclick={() => onselect(c.id)}
        >
          <Layers class="size-3.5 shrink-0 text-muted" />
          <span class="flex-1 truncate text-body-sm text-primary">{c.name}</span>
          {#if isOrg(c.ownerId)}<Building2 class="size-3 shrink-0 text-muted" />{/if}
        </button>
      {/each}
    {:else}
      {#each templates as t (t.id)}
        {@const Icon = memberMeta[t.kind].icon}
        <button
          class="dur-micro flex w-full items-center gap-2 rounded-control px-2 py-2 text-left transition-colors {t.id ===
          selectedId
            ? 'bg-selection'
            : 'hover:bg-work'}"
          onclick={() => onselect(t.id)}
        >
          <Icon class="size-3.5 shrink-0 text-muted" />
          <span class="flex-1 truncate text-body-sm text-primary">{t.name}</span>
          {#if isOrg(t.ownerId)}<Building2 class="size-3 shrink-0 text-muted" />{/if}
        </button>
      {/each}
    {/if}
  </div>
</aside>

<style>
  /* The repo's standing convention (SidePanel, TabStrip): keep wheel/touch/
     keyboard scrolling, drop the visible scrollbar chrome. */
  .quiet-scroll {
    scrollbar-width: none;
  }
  .quiet-scroll::-webkit-scrollbar {
    display: none;
  }
</style>
