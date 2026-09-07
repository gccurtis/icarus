<script lang="ts">
  import type { Snippet } from "svelte";

  import { ScreenEmpty } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";

  let {
    ready,
    error,
    what,
    onretry,
    children
  }: {
    ready: boolean;
    error?: string;
    what: string;
    onretry: () => void;
    children: Snippet;
  } = $props();
</script>

{#if error !== undefined}
  <div class="remote-state">
    <ScreenEmpty title="{what} could not be loaded">{error}</ScreenEmpty>
    <Button variant="outline" size="sm" onclick={onretry}>Retry</Button>
  </div>
{:else if !ready}
  <ScreenEmpty title="Loading {what.toLocaleLowerCase()}">
    Reading the project's agents from the representation store.
  </ScreenEmpty>
{:else}
  {@render children()}
{/if}

<style>
  .remote-state {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: calc(var(--token-spacing-unit) * 6);
  }
</style>
