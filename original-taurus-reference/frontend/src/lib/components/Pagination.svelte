<script lang="ts">
  import { cn } from '$lib/utils';

  let {
    page = $bindable(1),
    total = 1,
    class: className = ''
  }: { page?: number; total?: number; class?: string } = $props();

  function go(p: number) {
    page = Math.max(1, Math.min(total, p));
  }

  const pages = $derived.by(() => {
    const out: (number | '…')[] = [];
    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || Math.abs(i - page) <= 1) out.push(i);
      else if (out[out.length - 1] !== '…') out.push('…');
    }
    return out;
  });
</script>

<nav aria-label="Pagination" class={cn('inline-flex items-center gap-1', className)}>
  <button
    type="button"
    onclick={() => go(page - 1)}
    disabled={page <= 1}
    class="dur-micro rounded-control px-2 py-1 text-body-sm text-secondary transition-colors hover:bg-panel disabled:pointer-events-none disabled:opacity-40"
  >
    Prev
  </button>
  {#each pages as p, i (i)}
    {#if p === '…'}
      <span class="px-2 text-muted">…</span>
    {:else}
      <button
        type="button"
        aria-current={p === page ? 'page' : undefined}
        onclick={() => go(p)}
        class={cn(
          'dur-micro min-w-8 rounded-control px-2 py-1 text-body-sm tabular-nums transition-colors',
          p === page ? 'bg-action text-action-fg' : 'text-secondary hover:bg-panel'
        )}
      >
        {p}
      </button>
    {/if}
  {/each}
  <button
    type="button"
    onclick={() => go(page + 1)}
    disabled={page >= total}
    class="dur-micro rounded-control px-2 py-1 text-body-sm text-secondary transition-colors hover:bg-panel disabled:pointer-events-none disabled:opacity-40"
  >
    Next
  </button>
</nav>
