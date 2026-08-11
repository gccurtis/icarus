<script lang="ts">
  import { ChevronRight, FileText, Minus, Plus, Search, X } from '@lucide/svelte';
  import { Badge, Button, IconButton, Input, Modal, toast } from '$lib/components';
  import { iconTileClass } from '$data/projects';
  import {
    CONTEXTS,
    formatCount,
    memberMeta,
    type LibraryContext,
    type Member
  } from './library-mock';

  // The work surface for a context: its definition (two parallel sets) over the
  // resolved leaf set it produces. This mirrors Omega exactly — a context is a
  // `Definition{Includes, Excludes}` that `contexts.Resolve` flattens to leaves.
  let { context }: { context: LibraryContext } = $props();

  let expanded = $state<string | null>(null);
  let picked = $state<string | null>(null);
  let addOpen = $state<'include' | 'exclude' | null>(null);
</script>

{#snippet memberRow(m: Member, tone: 'include' | 'exclude')}
  {@const meta = memberMeta[m.kind]}
  {@const Icon = meta.icon}
  <div
    class="group dur-micro flex items-center gap-2 rounded-control px-1.5 py-1.5 transition-colors hover:bg-elevated"
  >
    {#if m.kind === 'context'}
      <button
        class="dur-micro flex size-6 shrink-0 items-center justify-center rounded-control {iconTileClass(
          'intel'
        )}"
        aria-label={expanded === m.id ? 'Collapse' : 'Expand'}
        onclick={() => (expanded = expanded === m.id ? null : m.id)}
      >
        <ChevronRight class="size-3.5 {expanded === m.id ? 'rotate-90' : ''} transition-transform" />
      </button>
    {:else}
      <span
        title={meta.label}
        class="flex size-6 shrink-0 items-center justify-center rounded-control {iconTileClass(
          meta.tone
        )}"
      >
        <Icon class="size-3.5" />
      </span>
    {/if}

    <span class="min-w-0 truncate text-body-sm text-secondary">{m.name}</span>
    {#if m.kind === 'context'}<Badge tone="intel" class="shrink-0">context</Badge>{/if}
    <span class="flex-1"></span>

    <span class="dur-micro flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
      {#if tone === 'include'}
        <IconButton size="sm" label="Move to excluded"><Minus class="size-3.5" /></IconButton>
      {:else}
        <IconButton size="sm" label="Move to included"><Plus class="size-3.5" /></IconButton>
      {/if}
      <IconButton size="sm" label="Remove"><X class="size-3.5" /></IconButton>
    </span>
  </div>

  {#if m.kind === 'context' && expanded === m.id && m.expands}
    <div class="ml-4 border-l border-intel/30 pl-3">
      {#each m.expands as child}
        <div class="flex items-center gap-2 py-1 pl-1.5 text-caption text-muted">
          <FileText class="size-3 shrink-0" />{child}
        </div>
      {/each}
    </div>
  {/if}
{/snippet}

<!-- Both halves of the definition are the same object, so they are one snippet:
     a panel-toned header strip over a work-toned body of rows. Excluded keeps
     Included's full height even when it holds one member — the two sides are
     equally important, and parity says so. -->
{#snippet setPanel(title: string, tone: 'include' | 'exclude')}
  {@const members = tone === 'include' ? context.includes : context.excludes}
  <section class="flex min-h-0 flex-col overflow-hidden rounded-panel border border-border">
    <div
      class="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-panel px-4 py-2.5"
    >
      <h2 class="flex items-center gap-2 text-body font-semibold">
        {#if tone === 'include'}
          <Plus class="size-4 text-success" />
        {:else}
          <Minus class="size-4 text-danger" />
        {/if}
        {title}
      </h2>
      <Button variant="ghost" size="sm" onclick={() => (addOpen = tone)}>
        <Plus class="size-3.5" /> Add
      </Button>
    </div>
    <div class="quiet-scroll min-h-0 flex-1 overflow-y-auto bg-work p-2">
      <p class="px-1.5 pb-2 text-caption text-muted">
        {tone === 'include'
          ? 'What this context is made of. Adding another context brings in everything inside it.'
          : 'Left out, even when something above brings it in.'}
      </p>
      {#if members.length}
        <div class="space-y-1">
          {#each members as m (m.id)}
            {@render memberRow(m, tone)}
          {/each}
        </div>
      {:else}
        <p class="px-1.5 py-1 text-caption text-muted">Nothing excluded.</p>
      {/if}
    </div>
  </section>
{/snippet}

<div class="flex min-h-0 flex-1 flex-col gap-4 px-8 pb-24">
  <div class="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
    {@render setPanel('Included', 'include')}
    {@render setPanel('Excluded', 'exclude')}
  </div>

  <!-- The result, in the resource table's grammar: no header row, the kind tile
       carries the type, capped at five rows so it never crowds the sets above. -->
  <section class="flex shrink-0 flex-col overflow-hidden rounded-panel border border-border">
    <h2 class="shrink-0 border-b border-border bg-panel px-4 py-2.5 text-body font-semibold">
      Resources
      <span class="font-normal text-muted">({formatCount(context.resolved.length)})</span>
    </h2>
    <div class="quiet-scroll max-h-56 overflow-y-auto bg-work">
      {#each context.resolved as r (r.name)}
        {@const meta = memberMeta[r.kind]}
        {@const Icon = meta.icon}
        <button
          onclick={() => (picked = picked === r.name ? null : r.name)}
          ondblclick={() => toast(`Would open “${r.name}”.`, { tone: 'intel' })}
          class="dur-micro grid w-full grid-cols-[minmax(0,1fr)_12rem] items-center gap-3 border-b border-border px-4 py-2 text-left transition-colors last:border-0 {picked ===
          r.name
            ? 'bg-selection'
            : 'hover:bg-elevated'}"
        >
          <span class="flex min-w-0 items-center gap-3">
            <span
              title={meta.label}
              class="flex size-7 shrink-0 items-center justify-center rounded-control {iconTileClass(
                meta.tone
              )}"
            >
              <Icon class="size-3.5" />
            </span>
            <span class="truncate text-body-sm text-secondary">{r.name}</span>
          </span>
          <!-- Only the top-level member it arrived through, so every row maps to
               something visible in Included above. -->
          <span class="truncate text-caption">
            {#if r.via.length}
              <span class="text-intel">{r.via[0]}</span>
            {:else}
              <span class="text-muted">Included directly</span>
            {/if}
          </span>
        </button>
      {/each}
    </div>
  </section>
</div>

<!-- Adding a member searches the whole library plus every resource, which does
     not fit beside the list it feeds. One modal serves both sets: including and
     excluding are the same act aimed at opposite sides of the definition. -->
<Modal
  open={addOpen !== null}
  title={addOpen === 'exclude' ? 'Exclude from this context' : 'Add to this context'}
  size="md"
>
  <div class="space-y-3">
    <p class="text-body-sm text-secondary">
      {addOpen === 'exclude'
        ? 'Anything picked here is subtracted, even when something included brings it in.'
        : 'Pick resources, or another context to bring in everything inside it.'}
    </p>
    <div class="relative">
      <Search
        class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted"
      />
      <Input
        size="sm"
        placeholder="Search resources and contexts"
        aria-label="Search resources and contexts"
        class="pl-8"
      />
    </div>
    <div class="quiet-scroll max-h-64 overflow-y-auto rounded-control border border-border p-1.5">
      <p class="px-1.5 pb-1 pt-1 text-caption uppercase tracking-wide text-muted">Contexts</p>
      {#each CONTEXTS.filter((c) => c.id !== context.id) as c (c.id)}
        <div class="dur-micro flex items-center gap-2 rounded-control px-1.5 py-1.5 hover:bg-elevated">
          <span
            class="flex size-6 shrink-0 items-center justify-center rounded-control {iconTileClass(
              'intel'
            )}"
          >
            <ChevronRight class="size-3.5" />
          </span>
          <span class="min-w-0 flex-1 truncate text-body-sm text-secondary">{c.name}</span>
          <span class="shrink-0 text-caption text-muted">{formatCount(c.resolved.length)}</span>
        </div>
      {/each}
      <p class="px-1.5 pb-1 pt-2 text-caption uppercase tracking-wide text-muted">Resources</p>
      {#each context.resolved as r (r.name)}
        {@const meta = memberMeta[r.kind]}
        {@const Icon = meta.icon}
        <div class="dur-micro flex items-center gap-2 rounded-control px-1.5 py-1.5 hover:bg-elevated">
          <span
            class="flex size-6 shrink-0 items-center justify-center rounded-control {iconTileClass(
              meta.tone
            )}"
          >
            <Icon class="size-3.5" />
          </span>
          <span class="min-w-0 flex-1 truncate text-body-sm text-secondary">{r.name}</span>
          <span class="shrink-0 text-caption text-muted">{meta.label}</span>
        </div>
      {/each}
    </div>
  </div>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (addOpen = null)}>Cancel</Button>
    <Button onclick={() => (addOpen = null)}>
      {addOpen === 'exclude' ? 'Exclude' : 'Include'}
    </Button>
  {/snippet}
</Modal>

<style>
  .quiet-scroll {
    scrollbar-width: none;
  }
  .quiet-scroll::-webkit-scrollbar {
    display: none;
  }
</style>
