<script lang="ts">
  import { Check, FileText, LibraryBig, Link2, MousePointer2 } from '@lucide/svelte';
  import { MockBadge, Tooltip } from '$lib/components';
  import {
    aiAgent,
    aiContextSourceOptions,
    toggleAiContextSource,
    type AiContextSourceId
  } from '$data/ai-agent';

  // The selectable context sources as a compact checkbox grid — rendered by both
  // the Context disclosure and the Current-context manager, so a toggle looks and
  // behaves identically in both places.
</script>

{#snippet sourceIcon(id: AiContextSourceId)}
  {#if id === 'document'}
    <FileText class="size-3.5 shrink-0" />
  {:else if id === 'selection'}
    <MousePointer2 class="size-3.5 shrink-0" />
  {:else if id === 'knowledge'}
    <LibraryBig class="size-3.5 shrink-0" />
  {:else}
    <Link2 class="size-3.5 shrink-0" />
  {/if}
{/snippet}

<div class="grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-1.5">
  {#each aiContextSourceOptions as source (source.id)}
    {@const selected = $aiAgent.contextSourceIds.includes(source.id)}
    <Tooltip content={source.detail} placement="left" class="w-full">
      <label
        class="dur-micro flex min-h-9 w-full cursor-pointer items-center gap-1.5 rounded-control border border-transparent px-2 py-1.5 text-caption font-medium transition-colors hover:border-border {selected
          ? 'text-action'
          : 'text-secondary hover:text-primary'}"
      >
        <input
          type="checkbox"
          checked={selected}
          onchange={() => toggleAiContextSource(source.id)}
          aria-label={source.label}
          class="peer sr-only"
        />
        <span
          class="dur-micro flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border bg-transparent transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus {selected
            ? 'border-action/70'
            : 'border-border'}"
        >
          {#if selected}
            <Check class="size-2 text-action" />
          {/if}
        </span>
        {@render sourceIcon(source.id)}
        <span class="min-w-0 flex-1 truncate leading-tight">{source.label}</span>
        {#if !source.wired}
          <MockBadge class="shrink-0 px-1 py-0 text-[10px] normal-case" />
        {/if}
      </label>
    </Tooltip>
  {/each}
</div>
