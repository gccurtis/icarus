<script lang="ts">
  import type { Snippet } from "svelte";

  let { children, actions }: { children: Snippet; actions?: Snippet } = $props();
</script>

<header class="head">
  <div class="words">{@render children()}</div>
  {#if actions}
    <div class="actions">{@render actions()}</div>
  {/if}
</header>

<style>
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 3) calc(var(--token-spacing-unit) * 6);
  }

  .words {
    display: flex;
    min-width: 0;
    flex: 1 1 24rem;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1.5);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 2);
  }
</style>
