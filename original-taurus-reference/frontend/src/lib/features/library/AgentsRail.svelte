<script lang="ts">
  import { goto } from '$app/navigation';
  import { Activity, Building2, Plus, Search, Sparkles, Star } from '@lucide/svelte';
  import { Divider, IconButton, Input, Select } from '$lib/components';
  import { OWNERS } from './library-mock';
  import type { Personality } from './agents-mock';

  // The Agents map: the live Activity view first — monitoring is the reason you
  // come here — then the personalities, which are the assets you build. A
  // personality is a sub-ROUTE (durable, shareable), so selecting one navigates.
  let {
    personalities,
    activeId,
    query = $bindable(''),
    owner = $bindable('all')
  }: {
    personalities: Personality[];
    /** The open personality's id, or null when the Activity view is open. */
    activeId: string | null;
    query?: string;
    owner?: string;
  } = $props();

  const isOrg = (id: string) => OWNERS.find((o) => o.id === id)?.kind === 'org';
</script>

<aside class="surface-context flex w-context shrink-0 flex-col">
  <div class="space-y-2 p-3">
    <p class="text-label uppercase tracking-wide text-muted">Agents</p>
    <button
      class="dur-micro flex w-full items-center gap-2 rounded-control px-2 py-2 text-left transition-colors {activeId ===
      null
        ? 'bg-selection'
        : 'hover:bg-work'}"
      onclick={() => goto('/library/agents')}
    >
      <Activity class="size-3.5 shrink-0 text-muted" />
      <span class="flex-1 truncate text-body-sm text-primary">Activity</span>
    </button>
  </div>

  <Divider />

  <div class="space-y-2 p-3 pb-2">
    <!-- The create affordance lives here, not on the space: personalities are
         what you make. Starting an agent needs no button — that is the bar. -->
    <div class="flex items-center justify-between">
      <p class="text-label uppercase tracking-wide text-muted">Personalities</p>
      <IconButton size="sm" label="New personality"><Plus class="size-4" /></IconButton>
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

  <div class="quiet-scroll min-h-0 flex-1 overflow-y-auto p-2 pt-0">
    {#each personalities as p (p.id)}
      <button
        class="dur-micro flex w-full items-center gap-2 rounded-control px-2 py-2 text-left transition-colors {p.id ===
        activeId
          ? 'bg-selection'
          : 'hover:bg-work'}"
        onclick={() => goto(`/library/agents/${p.id}`)}
      >
        <Sparkles class="size-3.5 shrink-0 text-muted" />
        <span class="flex-1 truncate text-body-sm text-primary">{p.name}</span>
        {#if p.isDefault}
          <Star class="size-3 shrink-0 fill-current text-attention" aria-label="Default" />
        {/if}
        {#if isOrg(p.ownerId)}<Building2 class="size-3 shrink-0 text-muted" />{/if}
      </button>
    {/each}
  </div>
</aside>

<style>
  .quiet-scroll {
    scrollbar-width: none;
  }
  .quiet-scroll::-webkit-scrollbar {
    display: none;
  }
</style>
