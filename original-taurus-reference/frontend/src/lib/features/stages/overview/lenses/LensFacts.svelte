<script lang="ts">
  // The label/value tail shared by the three Overview lenses. A local copy of the
  // document stage's `Facts` on purpose: stages never import each other, and this
  // is smaller than promoting a two-element <dl> into the component library.
  let { items }: { items: { label: string; value: string }[] } = $props();
</script>

<dl class="space-y-1.5">
  {#each items as item (item.label)}
    <div class="flex items-baseline justify-between gap-3">
      <dt class="shrink-0 text-caption text-muted">{item.label}</dt>
      <dd class="min-w-0 truncate text-right text-caption text-secondary">{item.value}</dd>
    </div>
  {/each}
</dl>
