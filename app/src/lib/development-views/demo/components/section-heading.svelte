<script lang="ts">
  let {
    eyebrow,
    title,
    source,
    lede
  }: { eyebrow: string; title: string; source: string; lede?: string } = $props();
</script>

<div class="flex flex-col gap-2">
  <span class="surface-eyebrow">{eyebrow}</span>
  <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
    <h2 class="text-h2 font-semibold">{title}</h2>
    <p class="text-micro text-ink-muted font-mono">{source}</p>
  </div>
  {#if lede}
    <p class="text-body-sm text-ink-secondary max-w-prose">{lede}</p>
  {/if}
</div>
