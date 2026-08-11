<script lang="ts">
  import { ArrowLeft, FileText, MousePointer2, Paperclip, X } from '@lucide/svelte';
  import { Input, Tooltip } from '$lib/components';
  import { aiAgent, excludeAiContextItem, toggleAiContextSource } from '$data/ai-agent';
  import { resources } from '$data/resources';
  import { workspace } from '$data/workspace';
  import ContextSources from './ContextSources.svelte';
  import { contextItemsFor, filterContextItems, type ContextItem } from './context-items';

  // The "Current context" manager — a full-panel view listing exactly what the
  // enabled sources contribute right now, searchable, each item removable.
  // Owns its search state, so leaving the view (unmount) resets it.
  let { onback }: { onback: () => void } = $props();

  let contextQuery = $state('');

  const activeTab = $derived(
    $workspace?.tabs.find((tab) => tab.id === $workspace.activeTabId) ?? null
  );
  const contextItems = $derived(
    contextItemsFor({
      enabled: $aiAgent.contextSourceIds,
      excluded: $aiAgent.excludedContextItemIds,
      activeTab,
      resources: $resources
    })
  );
  const filteredContextItems = $derived(filterContextItems(contextItems, contextQuery));

  // Whole-source items (the document, the selection) turn their source off;
  // per-item entries (a knowledge resource, a linked source) are excluded singly.
  function removeContextItem(item: ContextItem) {
    if (item.sourceId === 'document' || item.sourceId === 'selection') {
      toggleAiContextSource(item.sourceId);
      return;
    }
    excludeAiContextItem(item.id);
  }
</script>

{#snippet contextItemIcon(kind: ContextItem['kind'])}
  {#if kind === 'selection'}
    <MousePointer2 class="size-3.5 shrink-0 text-muted" />
  {:else if kind === 'file'}
    <Paperclip class="size-3.5 shrink-0 text-muted" />
  {:else}
    <FileText class="size-3.5 shrink-0 text-muted" />
  {/if}
{/snippet}

<div class="sticky top-0 z-10 -mx-3 flex items-center gap-2 border-b border-border bg-panel px-3 pb-3">
  <button
    onclick={onback}
    aria-label="Back to AI Agent"
    class="dur-micro flex size-7 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-elevated hover:text-primary"
  >
    <ArrowLeft class="size-4" />
  </button>
  <div class="min-w-0 flex-1">
    <p class="truncate text-body-sm font-medium text-primary">Current context</p>
    <p class="text-caption text-muted">What Taurus can use in the next request</p>
  </div>
</div>

<Input
  bind:value={contextQuery}
  size="sm"
  type="search"
  placeholder="Search current context…"
  aria-label="Search current context"
/>

<section aria-labelledby="context-sources-heading" class="space-y-2">
  <p id="context-sources-heading" class="text-caption font-medium text-secondary">Sources</p>
  <ContextSources />
</section>

<section aria-labelledby="context-items-heading" class="border-t border-border pt-3">
  <p id="context-items-heading" class="mb-2 text-caption font-medium text-secondary">Included</p>

  {#if filteredContextItems.length === 0}
    <p class="rounded-control border border-dashed border-border px-2.5 py-3 text-caption text-muted">
      {contextQuery ? 'No context matches this search.' : 'No context is currently included.'}
    </p>
  {:else}
    <ul class="divide-y divide-border overflow-hidden rounded-control border border-border">
      {#each filteredContextItems as item (item.id)}
        <li class="flex min-h-11 items-center gap-2 px-2.5 py-1.5">
          {@render contextItemIcon(item.kind)}
          <span class="min-w-0 flex-1">
            <span class="block truncate text-label font-medium text-secondary" title={item.name}>
              {item.name}
            </span>
            <span class="block truncate text-caption text-muted">{item.typeLabel}</span>
          </span>
          <Tooltip content={`Remove ${item.name} from context`} placement="left">
            <button
              type="button"
              onclick={() => removeContextItem(item)}
              aria-label={`Remove ${item.name} from context`}
              class="dur-micro flex size-7 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-elevated hover:text-danger"
            >
              <X class="size-3.5" />
            </button>
          </Tooltip>
        </li>
      {/each}
    </ul>
  {/if}
</section>
