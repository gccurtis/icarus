<script lang="ts">
  import { cn } from '$lib/utils';

  // A label/value list — the read-only tail of most lenses (words, characters, lines).
  let {
    items,
    divided = false
  }: { items: { label: string; value: string }[]; divided?: boolean } = $props();
</script>

<dl class={cn('space-y-1.5', divided && 'border-t border-border pt-3')}>
  {#each items as item (item.label)}
    <div class="flex items-baseline justify-between gap-3">
      <dt class="shrink-0 text-caption text-muted">{item.label}</dt>
      <dd class="truncate text-caption text-secondary">{item.value}</dd>
    </div>
  {/each}
</dl>
