<script lang="ts">
  import { cn } from '$lib/utils';

  type Crumb = { label: string; href?: string };

  let { items = [], class: className = '' }: { items?: Crumb[]; class?: string } = $props();
</script>

<nav aria-label="Breadcrumb" class={cn('flex items-center gap-1.5 text-body-sm text-muted', className)}>
  {#each items as item, i (item.label)}
    {#if i > 0}<span class="text-border-strong" aria-hidden="true">/</span>{/if}
    {#if item.href && i < items.length - 1}
      <a href={item.href} class="dur-micro rounded-[3px] transition-colors hover:text-primary">
        {item.label}
      </a>
    {:else}
      <span class="text-primary" aria-current="page">{item.label}</span>
    {/if}
  {/each}
</nav>
