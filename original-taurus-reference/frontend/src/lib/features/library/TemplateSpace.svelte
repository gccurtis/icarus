<script lang="ts">
  import { Layers, Pencil, Plus, Search } from '@lucide/svelte';
  import {
    Button,
    Chip,
    Input,
    Modal,
    SegmentedControl,
    Textarea,
    toast
  } from '$lib/components';
  import { iconTileClass } from '$data/projects';
  import {
    CONTEXTS,
    formatCount,
    memberMeta,
    type LibraryTemplate
  } from './library-mock';

  // The work surface for a template: the preview above, its context slots below.
  // The two are equally important — a template's context is AUTHORED here, not
  // merely displayed — so the slots get a fixed share of the height.
  let { template }: { template: LibraryTemplate } = $props();

  let previewMode = $state('prompt');
  let chosen = $state<Record<string, string>>({});
  let slot = $state<string | null>(null);
  let chooseFor = $state<string | null>(null);
  let chooseQuery = $state('');

  let activeSlot = $derived(template.variables.find((v) => v.name === slot) ?? null);
  let chooseList = $derived(
    CONTEXTS.filter((c) =>
      `${c.name} ${c.description}`.toLocaleLowerCase().includes(chooseQuery.trim().toLocaleLowerCase())
    )
  );
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4 px-8 pb-24">
  <section class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel border border-border">
    <div
      class="relative flex shrink-0 items-center justify-between gap-2 border-b border-border bg-panel px-4 py-2"
    >
      <h2 class="text-body font-semibold">Preview</h2>
      <!-- Prompt = the template as authored, slots unfilled.
           Content = the same template with its context slots resolved. -->
      <SegmentedControl
        bind:value={previewMode}
        class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        segments={[
          { value: 'prompt', label: 'Prompt' },
          { value: 'content', label: 'Content' }
        ]}
      />
      <div class="flex items-center gap-2">
        <span class="text-caption text-muted">{memberMeta[template.kind].label}</span>
        <Button
          variant="ghost"
          size="sm"
          onclick={() => toast('Editing a template is not wired up yet.', { tone: 'attention' })}
        >
          <Pencil class="size-3.5" /> Edit
        </Button>
      </div>
    </div>

    <!-- `bg-work` on the scroller, not the content, so the paper fills the frame
         instead of stopping where the text ends. -->
    <div class="quiet-scroll min-h-0 flex-1 overflow-y-auto border-border bg-work">
      {#if template.kind === 'document' && template.doc}
        <div class="px-8 py-7">
          {#each template.doc as blk, i (i)}
            {#if blk.type === 'heading'}
              <h3 class="mb-2 mt-5 text-body-lg font-semibold first:mt-0">{blk.text}</h3>
            {:else if blk.type === 'prompt'}
              <div
                class="my-2 rounded-control border border-intel/40 bg-intel/5 px-3 py-2 text-body-sm text-intel"
              >
                <p>{blk.text}</p>
                {#if blk.context}
                  <!-- A prompt block is SCOPED to a slot, never interpolated —
                       Omega's BlockContext over declared variable names. -->
                  <p class="mt-1.5 flex items-center gap-1.5 text-caption">
                    <Layers class="size-3 shrink-0" />
                    Reads
                    {#if previewMode === 'content' && chosen[blk.context]}
                      <span class="font-medium">{chosen[blk.context]}</span>
                    {:else}
                      <span class="rounded border border-dashed border-intel/50 px-1.5">
                        {blk.context}
                      </span>
                    {/if}
                  </p>
                {/if}
              </div>
            {:else if blk.type === 'list'}
              <ul class="my-2 list-disc pl-5 text-body-sm text-secondary">
                <li>{blk.text}</li>
                <li class="text-muted">…</li>
              </ul>
            {:else}
              <p class="my-2 text-body-sm text-secondary">{blk.text}</p>
            {/if}
          {/each}
        </div>
      {:else if template.kind === 'spreadsheet' && template.sheet}
        <div class="quiet-scroll overflow-x-auto">
          <table class="w-full border-collapse text-caption">
            <thead>
              <tr>
                <th class="border-b border-r border-border bg-panel px-2 py-1"></th>
                {#each template.sheet.columns as _, i (i)}
                  <th
                    class="border-b border-r border-border bg-panel px-2 py-1 text-left font-normal text-muted"
                  >
                    {String.fromCharCode(65 + i)}
                  </th>
                {/each}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="border-b border-r border-border bg-panel px-2 py-1 text-muted">1</td>
                {#each template.sheet.columns as c (c)}
                  <td class="border-b border-r border-border px-2 py-1 font-medium text-primary">
                    {c}
                  </td>
                {/each}
              </tr>
              {#each template.sheet.rows as row, ri (ri)}
                <tr>
                  <td class="border-b border-r border-border bg-panel px-2 py-1 text-muted">
                    {ri + 2}
                  </td>
                  {#each row as cell, ci (ci)}
                    <td
                      class="border-b border-r border-border px-2 py-1 {cell.startsWith('=')
                        ? 'font-mono text-intel'
                        : 'text-secondary'}"
                    >
                      {cell}
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </section>

  <!-- NOT prompt placeholders: each entry is background material the template
       needs, filled by a context from the library. -->
  <section class="flex h-72 shrink-0 flex-col overflow-hidden rounded-panel border border-border">
    <div
      class="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-panel px-4 py-2.5"
    >
      <h2 class="text-body font-semibold">
        Context <span class="font-normal text-muted">({template.variables.length})</span>
      </h2>
      <Button variant="ghost" size="sm"><Plus class="size-3.5" /> Add</Button>
    </div>

    {#if template.variables.length}
      <!-- List left, an inspector-style editor right: a slot's name and purpose
           are authored, not just displayed. -->
      <div class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div class="quiet-scroll min-h-0 overflow-y-auto bg-work p-2">
          <div class="space-y-1">
            {#each template.variables as v (v.name)}
              <button
                onclick={() => (slot = v.name)}
                class="dur-micro flex w-full items-center gap-2 rounded-control px-1.5 py-1.5 text-left transition-colors {slot ===
                v.name
                  ? 'bg-selection'
                  : 'hover:bg-elevated'}"
              >
                <span
                  class="flex size-6 shrink-0 items-center justify-center rounded-control {iconTileClass(
                    'intel'
                  )}"
                >
                  <Layers class="size-3.5" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-body-sm text-secondary">{v.name}</span>
                  <span class="block truncate text-caption text-muted">{v.description}</span>
                </span>
                {#if chosen[v.name]}
                  <Chip tone="intel" class="shrink-0">{chosen[v.name]}</Chip>
                {:else}
                  <span class="shrink-0 text-caption text-muted">Not chosen</span>
                {/if}
              </button>
            {/each}
          </div>
        </div>

        <div class="quiet-scroll min-h-0 overflow-y-auto border-l border-border bg-panel p-3">
          {#if activeSlot}
            <div class="space-y-2.5">
              <div>
                <label class="mb-1 block text-caption text-muted" for="slot-name">Name</label>
                <Input id="slot-name" size="sm" value={activeSlot.name} />
              </div>
              <div>
                <label class="mb-1 block text-caption text-muted" for="slot-desc">
                  What it is for
                </label>
                <Textarea id="slot-desc" rows={2} value={activeSlot.description} />
              </div>
              <div>
                <span class="mb-1 block text-caption text-muted">Context</span>
                {#if chosen[activeSlot.name]}
                  <Chip tone="intel" onremove={() => delete chosen[activeSlot!.name]}>
                    {chosen[activeSlot.name]}
                  </Chip>
                {:else}
                  <Button
                    variant="secondary"
                    size="sm"
                    class="text-action"
                    onclick={() => (chooseFor = activeSlot!.name)}
                  >
                    <Layers class="size-3.5" /> Choose a context
                  </Button>
                {/if}
              </div>
            </div>
          {:else}
            <p class="text-caption text-muted">Select a context slot to edit it.</p>
          {/if}
        </div>
      </div>
    {:else}
      <p class="bg-work p-3 text-caption text-muted">
        Nothing — this template is pure structure and needs no background material.
      </p>
    {/if}
  </section>
</div>

<!-- A modal, not a dropdown: the whole library is searchable here, and a menu
     anchored inside a short panel ran off the bottom of the screen. -->
<Modal
  open={chooseFor !== null}
  title={chooseFor ? `Choose a context for “${chooseFor}”` : 'Choose a context'}
  size="sm"
>
  <div class="space-y-3">
    <div class="relative">
      <Search
        class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted"
      />
      <Input
        bind:value={chooseQuery}
        size="sm"
        placeholder="Search contexts"
        aria-label="Search contexts"
        class="pl-8"
      />
    </div>
    <div class="quiet-scroll max-h-72 overflow-y-auto rounded-control border border-border p-1.5">
      {#each chooseList as c (c.id)}
        <button
          class="dur-micro flex w-full items-center gap-2 rounded-control px-1.5 py-1.5 text-left transition-colors hover:bg-elevated"
          onclick={() => {
            if (chooseFor) chosen[chooseFor] = c.name;
            chooseFor = null;
            chooseQuery = '';
          }}
        >
          <span
            class="flex size-6 shrink-0 items-center justify-center rounded-control {iconTileClass(
              'intel'
            )}"
          >
            <Layers class="size-3.5" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-body-sm text-secondary">{c.name}</span>
            <span class="block truncate text-caption text-muted">{c.description}</span>
          </span>
          <span class="shrink-0 text-caption text-muted">{formatCount(c.resolved.length)}</span>
        </button>
      {/each}
    </div>
  </div>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (chooseFor = null)}>Cancel</Button>
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
