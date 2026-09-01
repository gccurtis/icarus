<script lang="ts">
  import Commented from "$development-views/vocabulary/components/commented.svelte";

  /** A section heading, and where the thing it documents lives on disk. */
  let { title, source, children }: { title: string; source: string; children?: import("svelte").Snippet } = $props();
</script>

<Commented scope="section" label={title}>
  <div class="flex flex-col gap-1">
    <h2 class="text-h3 font-semibold">{title}</h2>
    <p class="text-caption text-ink-muted m-0 font-mono">{source}</p>
    {#if children}
      <p class="text-body-sm text-ink-secondary mt-1 mb-0 max-w-[70ch]">{@render children()}</p>
    {/if}
  </div>
</Commented>
