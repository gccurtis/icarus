<script lang="ts">
  /** A section title plus the document that specifies it, so every claim on the
   * page is traceable to the contract beside its stylesheet. */
  let { title, source }: { title: string; source: string } = $props();
</script>

<div class="flex flex-col gap-1">
  <h2 class="text-h3 font-semibold">{title}</h2>
  <p class="text-caption text-ink-muted font-mono">{source}</p>
</div>
