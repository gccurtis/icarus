<script lang="ts">
  import { cn } from '$lib/utils';

  type Row = { key: string; value: string };

  let { rows = [], class: className = '' }: { rows?: Row[]; class?: string } = $props();
</script>

<dl class={cn('divide-y divide-border', className)}>
  {#each rows as row (row.key)}
    <div class="flex items-center justify-between gap-4 py-2 text-body-sm">
      <dt class="text-muted">{row.key}</dt>
      <dd class="font-mono tabular-nums text-primary">{row.value}</dd>
    </div>
  {/each}
</dl>
