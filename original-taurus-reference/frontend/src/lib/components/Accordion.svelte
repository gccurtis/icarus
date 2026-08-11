<script lang="ts">
  import { slide } from 'svelte/transition';
  import { cn } from '$lib/utils';
  import { motionDuration, EASE } from '$lib/motion';

  type Item = { id: string; title: string; content: string };

  let {
    items = [],
    multiple = false,
    class: className = ''
  }: {
    items?: Item[];
    multiple?: boolean;
    class?: string;
  } = $props();

  let openIds = $state<string[]>([]);

  function toggle(id: string) {
    if (openIds.includes(id)) openIds = openIds.filter((x) => x !== id);
    else openIds = multiple ? [...openIds, id] : [id];
  }
</script>

<div class={cn('divide-y divide-border overflow-hidden rounded-panel border border-border', className)}>
  {#each items as item (item.id)}
    {@const isOpen = openIds.includes(item.id)}
    <div>
      <button
        type="button"
        aria-expanded={isOpen}
        onclick={() => toggle(item.id)}
        class="dur-small flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-body-sm font-medium text-primary transition-colors hover:bg-panel"
      >
        <span>{item.title}</span>
        <svg
          class={cn('dur-small size-4 shrink-0 text-muted transition-transform', isOpen && 'rotate-180')}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg
        >
      </button>
      {#if isOpen}
        <div
          transition:slide={{ duration: motionDuration(220), easing: EASE }}
          class="px-4 pb-3 text-body-sm text-secondary"
        >
          {item.content}
        </div>
      {/if}
    </div>
  {/each}
</div>
