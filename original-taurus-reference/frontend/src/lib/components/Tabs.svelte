<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';

  type Tab = { value: string; label: string };

  let {
    value = $bindable(''),
    tabs = [],
    class: className = '',
    children
  }: {
    value?: string;
    tabs?: Tab[];
    class?: string;
    /** Panel content; receives the active tab value. */
    children?: Snippet<[string]>;
  } = $props();

  $effect(() => {
    if (!value && tabs.length) value = tabs[0].value;
  });
</script>

<div class={className}>
  <div role="tablist" class="flex items-center gap-1 border-b border-border">
    {#each tabs as tab (tab.value)}
      <button
        role="tab"
        aria-selected={value === tab.value}
        onclick={() => (value = tab.value)}
        class={cn(
          'dur-small -mb-px border-b-2 px-3 py-2 text-body-sm font-medium transition-colors',
          value === tab.value
            ? 'border-action text-primary'
            : 'border-transparent text-muted hover:text-secondary'
        )}
      >
        {tab.label}
      </button>
    {/each}
  </div>
  {#if children}<div class="pt-4">{@render children(value)}</div>{/if}
</div>
