<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';

  let {
    title,
    description = undefined,
    class: className = '',
    icon,
    action
  }: {
    title: string;
    description?: string;
    class?: string;
    icon?: Snippet;
    action?: Snippet;
  } = $props();
</script>

<div
  class={cn(
    'flex flex-col items-center justify-center gap-3 rounded-panel border border-dashed border-border px-6 py-12 text-center',
    className
  )}
>
  {#if icon}<div class="text-muted">{@render icon()}</div>{/if}
  <div>
    <p class="text-body font-semibold text-primary">{title}</p>
    {#if description}<p class="mt-1 text-body-sm text-muted">{description}</p>{/if}
  </div>
  {#if action}<div class="mt-1">{@render action()}</div>{/if}
</div>
