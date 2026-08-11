<script lang="ts">
  import { cn } from '$lib/utils';

  type Column = { key: string; label: string; align?: 'left' | 'right' };

  let {
    columns = [],
    rows = [],
    class: className = ''
  }: {
    columns?: Column[];
    rows?: Record<string, string | number>[];
    class?: string;
  } = $props();
</script>

<div class={cn('overflow-x-auto rounded-panel border border-border', className)}>
  <table class="w-full border-collapse text-body-sm">
    <thead>
      <tr class="border-b border-border bg-panel/50">
        {#each columns as col (col.key)}
          <th
            class={cn(
              'px-4 py-2.5 text-label font-medium uppercase tracking-wide text-muted',
              col.align === 'right' ? 'text-right' : 'text-left'
            )}
          >
            {col.label}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as row, i (i)}
        <tr class="dur-micro border-b border-border transition-colors last:border-0 hover:bg-panel/50">
          {#each columns as col (col.key)}
            <td
              class={cn(
                'px-4 py-2.5 text-secondary',
                col.align === 'right' ? 'text-right font-mono tabular-nums' : 'text-left'
              )}
            >
              {row[col.key]}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
